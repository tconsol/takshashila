import request from 'supertest';
import express from 'express';
import attendanceRoutes from '../../modules/attendance/attendance.routes';
import { errorMiddleware } from '../../middlewares/error.middleware';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { studentService } from '../../modules/students/student.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: { headers: Record<string, string>; user?: unknown }, _res: never, next: () => void) => {
    req.user = { publicId: req.headers['x-test-user'] ?? 'user-1', role: req.headers['x-test-role'] ?? 'TUTOR' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const app = express();
app.use(express.json());
app.use('/api/v1/attendance', attendanceRoutes);
app.use(errorMiddleware);

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const CLASS = { publicId: 'c1', tutorPublicId: 'tp-owner', studentPublicId: 'sp-1' };

describe('attendance routes', () => {
  let mark: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(CLASS) as never);
    // A tutor user maps to a tutor profile; only tu-owner owns the class.
    jest.spyOn(TutorProfileModel, 'findOne').mockImplementation(((f: { userPublicId?: string; publicId?: string }) =>
      lean(f.userPublicId === 'tu-owner' ? { publicId: 'tp-owner' } : f.userPublicId ? { publicId: 'tp-other' } : { publicId: f.publicId })) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(((f: { userPublicId?: string }) =>
      lean(f.userPublicId === 'su-1' ? { publicId: 'sp-1' } : f.userPublicId === 'su-2' ? { publicId: 'sp-2' } : null)) as never);
    jest.spyOn(tutorService, 'getByUserPublicId').mockImplementation((async (u: string) => ({
      publicId: u === 'tu-owner' ? 'tp-owner' : 'tp-other',
    })) as never);
    mark = jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({ publicId: 'att-1' } as never);
    jest.spyOn(attendanceService, 'getByClass').mockResolvedValue([
      { publicId: 'r1', studentPublicId: 'sp-1' },
      { publicId: 'r2', studentPublicId: 'sp-2' },
    ] as never);
    jest.spyOn(studentService, 'getByUserPublicId').mockImplementation((async (u: string) => ({
      publicId: u === 'su-1' ? 'sp-1' : 'sp-2',
    })) as never);
  });

  describe('POST /mark', () => {
    const body = { classPublicId: 'c1', studentPublicId: 'sp-1', status: 'PRESENT' };

    it('blocks a tutor who does not own the class (404) and marks nothing', async () => {
      const res = await request(app).post('/api/v1/attendance/mark').set('x-test-user', 'tu-other').send(body);
      expect(res.status).toBe(404);
      expect(mark).not.toHaveBeenCalled();
    });
    it('lets the owning tutor mark', async () => {
      const res = await request(app).post('/api/v1/attendance/mark').set('x-test-user', 'tu-owner').send(body);
      expect(res.status).toBe(201);
      expect(mark).toHaveBeenCalledWith(body, 'tp-owner');
    });
    it('rejects a student who is not part of the class (422)', async () => {
      const res = await request(app).post('/api/v1/attendance/mark').set('x-test-user', 'tu-owner')
        .send({ ...body, studentPublicId: 'sp-9' });
      expect(res.status).toBe(422);
      expect(mark).not.toHaveBeenCalled();
    });
    it('a student cannot mark attendance', async () => {
      const res = await request(app).post('/api/v1/attendance/mark').set('x-test-user', 'su-1').set('x-test-role', 'STUDENT').send(body);
      expect([403, 404]).toContain(res.status);
      expect(mark).not.toHaveBeenCalled();
    });
  });

  describe('GET /class/:classId', () => {
    it('a student sees only their own record', async () => {
      const res = await request(app).get('/api/v1/attendance/class/c1').set('x-test-user', 'su-1').set('x-test-role', 'STUDENT');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ publicId: 'r1', studentPublicId: 'sp-1' }]);
    });
    it('a student from another class gets 404', async () => {
      const res = await request(app).get('/api/v1/attendance/class/c1').set('x-test-user', 'su-2').set('x-test-role', 'STUDENT');
      expect(res.status).toBe(404);
      expect(attendanceService.getByClass).not.toHaveBeenCalled();
    });
    it('the class tutor sees the full roster', async () => {
      const res = await request(app).get('/api/v1/attendance/class/c1').set('x-test-user', 'tu-owner');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
    it('an admin sees the full roster', async () => {
      const res = await request(app).get('/api/v1/attendance/class/c1').set('x-test-user', 'ad').set('x-test-role', 'ADMIN');
      expect(res.body.data).toHaveLength(2);
    });
    it('an unrelated tutor gets 404', async () => {
      const res = await request(app).get('/api/v1/attendance/class/c1').set('x-test-user', 'tu-other');
      expect(res.status).toBe(404);
    });
  });
});
