// Comprehensive world IANA timezone list with UTC offsets
// Uses Intl.supportedValuesOf at runtime (all modern browsers/Node 12+) with a
// curated static fallback so the list is always available.

function getOffsetStr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    } as Intl.DateTimeFormatOptions).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function buildOptions(zones: string[]) {
  return zones
    .map((tz) => ({
      value: tz,
      label: `(${getOffsetStr(tz)}) ${tz.replace(/_/g, ' ')}`,
    }))
    .sort((a, b) => {
      // Sort by numeric offset then alphabetically
      const offA = offsetMinutes(a.value);
      const offB = offsetMinutes(b.value);
      return offA !== offB ? offA - offB : a.value.localeCompare(b.value);
    });
}

function offsetMinutes(tz: string): number {
  try {
    const now = new Date();
    const utcMs = now.getTime();
    const localMs = new Date(
      now.toLocaleString('en-US', { timeZone: tz }),
    ).getTime();
    return Math.round((localMs - utcMs) / 60000);
  } catch {
    return 0;
  }
}

// Static fallback covering all major regions (used when Intl.supportedValuesOf unavailable)
const FALLBACK_ZONES: string[] = [
  'Pacific/Midway', 'Pacific/Niue', 'Pacific/Pago_Pago',
  'Pacific/Honolulu', 'Pacific/Rarotonga', 'Pacific/Tahiti',
  'Pacific/Marquesas',
  'America/Adak', 'Pacific/Gambier',
  'America/Anchorage', 'America/Juneau', 'America/Nome', 'America/Sitka', 'America/Yakutat', 'Pacific/Pitcairn',
  'America/Dawson', 'America/Los_Angeles', 'America/Phoenix', 'America/Tijuana', 'America/Vancouver',
  'America/Whitehorse', 'America/Santa_Isabel',
  'America/Boise', 'America/Cambridge_Bay', 'America/Chihuahua', 'America/Creston', 'America/Dawson_Creek',
  'America/Denver', 'America/Edmonton', 'America/Fort_Nelson', 'America/Hermosillo', 'America/Inuvik',
  'America/Mazatlan', 'America/Ojinaga', 'America/Yellowknife',
  'America/Belize', 'America/Chicago', 'America/Costa_Rica', 'America/El_Salvador', 'America/Guatemala',
  'America/Indiana/Knox', 'America/Indiana/Tell_City', 'America/Managua', 'America/Matamoros',
  'America/Menominee', 'America/Merida', 'America/Mexico_City', 'America/Monterrey', 'America/North_Dakota/Beulah',
  'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/Rainy_River', 'America/Rankin_Inlet',
  'America/Regina', 'America/Resolute', 'America/Swift_Current', 'America/Tegucigalpa', 'America/Winnipeg',
  'Pacific/Easter', 'Pacific/Galapagos',
  'America/Bogota', 'America/Cancun', 'America/Cayman', 'America/Detroit', 'America/Grand_Turk',
  'America/Guayaquil', 'America/Havana', 'America/Indiana/Indianapolis', 'America/Indiana/Marengo',
  'America/Indiana/Petersburg', 'America/Indiana/Vevay', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
  'America/Iqaluit', 'America/Jamaica', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
  'America/Lima', 'America/Nassau', 'America/New_York', 'America/Nipigon', 'America/Panama', 'America/Pangnirtung',
  'America/Port-au-Prince', 'America/Thunder_Bay', 'America/Toronto',
  'America/Anguilla', 'America/Antigua', 'America/Aruba', 'America/Asuncion', 'America/Barbados',
  'America/Blanc-Sablon', 'America/Boa_Vista', 'America/Campo_Grande', 'America/Caracas', 'America/Cuiaba',
  'America/Curacao', 'America/Dominica', 'America/Eirunepe', 'America/Glace_Bay', 'America/Goose_Bay',
  'America/Grenada', 'America/Guadeloupe', 'America/Guyana', 'America/Halifax', 'America/Kralendijk',
  'America/La_Paz', 'America/Lower_Princes', 'America/Manaus', 'America/Marigot', 'America/Martinique',
  'America/Moncton', 'America/Montserrat', 'America/Port_of_Spain', 'America/Porto_Velho',
  'America/Puerto_Rico', 'America/Rio_Branco', 'America/Santiago', 'America/Santo_Domingo', 'America/St_Barthelemy',
  'America/St_Kitts', 'America/St_Lucia', 'America/St_Thomas', 'America/St_Vincent', 'America/Thule',
  'America/Tortola', 'Atlantic/Bermuda', 'Atlantic/Stanley',
  'America/St_Johns',
  'America/Araguaina', 'America/Bahia', 'America/Belem', 'America/Cayenne', 'America/Fortaleza',
  'America/Maceio', 'America/Miquelon', 'America/Paramaribo', 'America/Recife', 'America/Santarem',
  'America/Sao_Paulo', 'Antarctica/Rothera', 'Atlantic/South_Georgia',
  'America/Godthab', 'America/Montevideo', 'America/Noronha', 'Atlantic/Cape_Verde',
  'America/Scoresbysund', 'Atlantic/Azores',
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Bamako', 'Africa/Banjul', 'Africa/Bissau', 'Africa/Conakry',
  'Africa/Dakar', 'Africa/Freetown', 'Africa/Lome', 'Africa/Monrovia', 'Africa/Nouakchott',
  'Africa/Ouagadougou', 'Africa/Sao_Tome', 'Atlantic/Reykjavik', 'Atlantic/St_Helena',
  'Europe/Dublin', 'Europe/Guernsey', 'Europe/Isle_of_Man', 'Europe/Jersey', 'Europe/Lisbon',
  'Europe/London', 'UTC',
  'Africa/Algiers', 'Africa/Bangui', 'Africa/Brazzaville', 'Africa/Ceuta', 'Africa/Douala',
  'Africa/Kinshasa', 'Africa/Lagos', 'Africa/Libreville', 'Africa/Luanda', 'Africa/Malabo',
  'Africa/Ndjamena', 'Africa/Niamey', 'Africa/Porto-Novo', 'Africa/Tunis',
  'Arctic/Longyearbyen', 'Atlantic/Canary', 'Atlantic/Faroe', 'Atlantic/Madeira',
  'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Bratislava',
  'Europe/Brussels', 'Europe/Budapest', 'Europe/Busingen', 'Europe/Copenhagen', 'Europe/Gibraltar',
  'Europe/Ljubljana', 'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Monaco',
  'Europe/Oslo', 'Europe/Paris', 'Europe/Podgorica', 'Europe/Prague', 'Europe/Rome', 'Europe/San_Marino',
  'Europe/Sarajevo', 'Europe/Skopje', 'Europe/Stockholm', 'Europe/Tirane', 'Europe/Vaduz',
  'Europe/Vatican', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zagreb', 'Europe/Zurich',
  'Africa/Blantyre', 'Africa/Bujumbura', 'Africa/Cairo', 'Africa/Gaborone', 'Africa/Harare',
  'Africa/Johannesburg', 'Africa/Juba', 'Africa/Khartoum', 'Africa/Kigali', 'Africa/Lubumbashi',
  'Africa/Lusaka', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane', 'Africa/Tripoli',
  'Africa/Windhoek', 'Asia/Amman', 'Asia/Beirut', 'Asia/Damascus', 'Asia/Famagusta',
  'Asia/Gaza', 'Asia/Hebron', 'Asia/Jerusalem', 'Asia/Nicosia',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Chisinau', 'Europe/Helsinki', 'Europe/Kaliningrad',
  'Europe/Kiev', 'Europe/Mariehamn', 'Europe/Minsk', 'Europe/Nicosia', 'Europe/Riga',
  'Europe/Sofia', 'Europe/Tallinn', 'Europe/Uzhgorod', 'Europe/Vilnius', 'Europe/Zaporozhye',
  'Africa/Addis_Ababa', 'Africa/Asmara', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Kampala',
  'Africa/Mogadishu', 'Africa/Nairobi', 'Antarctica/Syowa', 'Asia/Aden', 'Asia/Baghdad',
  'Asia/Bahrain', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Riyadh', 'Indian/Antananarivo',
  'Indian/Comoro', 'Indian/Mayotte',
  'Europe/Istanbul', 'Europe/Moscow', 'Europe/Simferopol', 'Europe/Volgograd',
  'Asia/Dubai', 'Asia/Muscat', 'Asia/Tbilisi', 'Asia/Yerevan', 'Indian/Mahe', 'Indian/Mauritius',
  'Indian/Reunion', 'Europe/Astrakhan', 'Europe/Samara', 'Europe/Saratov', 'Europe/Ulyanovsk',
  'Asia/Kabul',
  'Antarctica/Mawson', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Ashgabat', 'Asia/Atyrau',
  'Asia/Dushanbe', 'Asia/Karachi', 'Asia/Oral', 'Asia/Samarkand', 'Asia/Tashkent',
  'Asia/Yekaterinburg', 'Indian/Kerguelen', 'Indian/Maldives',
  'Asia/Calcutta', 'Asia/Colombo',
  'Asia/Kathmandu',
  'Antarctica/Vostok', 'Asia/Almaty', 'Asia/Bishkek', 'Asia/Dhaka', 'Asia/Omsk',
  'Asia/Qostanay', 'Asia/Thimphu', 'Asia/Urumqi', 'Indian/Chagos',
  'Asia/Rangoon', 'Indian/Cocos',
  'Antarctica/Davis', 'Asia/Bangkok', 'Asia/Barnaul', 'Asia/Ho_Chi_Minh', 'Asia/Hovd',
  'Asia/Jakarta', 'Asia/Krasnoyarsk', 'Asia/Novokuznetsk', 'Asia/Novosibirsk',
  'Asia/Phnom_Penh', 'Asia/Pontianak', 'Asia/Tomsk', 'Asia/Vientiane', 'Indian/Christmas',
  'Asia/Brunei', 'Asia/Choibalsan', 'Asia/Hong_Kong', 'Asia/Irkutsk', 'Asia/Kuala_Lumpur',
  'Asia/Kuching', 'Asia/Macau', 'Asia/Makassar', 'Asia/Manila', 'Asia/Shanghai',
  'Asia/Singapore', 'Asia/Taipei', 'Asia/Ulaanbaatar', 'Australia/Perth',
  'Australia/Eucla',
  'Asia/Chita', 'Asia/Dili', 'Asia/Jayapura', 'Asia/Khandyga', 'Asia/Pyongyang',
  'Asia/Seoul', 'Asia/Tokyo', 'Asia/Yakutsk', 'Pacific/Palau',
  'Australia/Adelaide', 'Australia/Broken_Hill', 'Australia/Darwin',
  'Antarctica/DumontDUrville', 'Antarctica/Macquarie', 'Asia/Ust-Nehr', 'Asia/Vladivostok',
  'Australia/Brisbane', 'Australia/Currie', 'Australia/Hobart', 'Australia/Lindeman',
  'Australia/Lord_Howe', 'Australia/Melbourne', 'Australia/Sydney',
  'Pacific/Chuuk', 'Pacific/Guam', 'Pacific/Port_Moresby', 'Pacific/Saipan',
  'Australia/Lord_Howe',
  'Antarctica/Casey', 'Asia/Magadan', 'Asia/Sakhalin', 'Asia/Srednekolymsk',
  'Pacific/Bougainville', 'Pacific/Efate', 'Pacific/Guadalcanal', 'Pacific/Kosrae',
  'Pacific/Noumea', 'Pacific/Pohnpei',
  'Antarctica/McMurdo', 'Asia/Anadyr', 'Asia/Kamchatka',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Funafuti', 'Pacific/Kwajalein',
  'Pacific/Majuro', 'Pacific/Nauru', 'Pacific/Tarawa', 'Pacific/Wake', 'Pacific/Wallis',
  'Pacific/Chatham',
  'Pacific/Apia', 'Pacific/Enderbury', 'Pacific/Fakaofo', 'Pacific/Tongatapu',
  'Pacific/Kiritimati',
];

let _cache: { value: string; label: string }[] | null = null;

export function getTimezoneOptions(): { value: string; label: string }[] {
  if (_cache) return _cache;

  let zones: string[];
  try {
    // Available in Chrome 99+, Firefox 93+, Safari 15.4+, Node 12+
    zones = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }

  _cache = buildOptions(zones);
  return _cache;
}

// Eagerly-built export for convenience (computed once at module load)
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = getTimezoneOptions();
