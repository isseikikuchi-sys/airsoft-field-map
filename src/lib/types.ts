export type FieldType =
  | 'インドア'
  | 'アウトドア森林'
  | 'アウトドア市街地（CQB）'
  | '混合'
  | '廃墟系'
  | 'その他';

export type Region = '北海道' | '東北' | '関東' | '中部' | '関西' | '中国' | '四国' | '九州' | '沖縄';

export interface Field {
  id: string;
  name: string;
  prefecture: string;
  region: Region;
  address: string;
  type: FieldType;
  official_url: string | null;
  events_url: string | null;
  reservation_url: string | null;
  twitter_x: string | null;
  size_sqm: number | null;
  lat: number | null;
  lng: number | null;
  notes: string;
  gallery_urls: string[];
}

export interface FieldsFile {
  _meta: {
    note: string;
    last_updated: string | null;
    schema_version: number;
  };
  fields: Field[];
}

export interface ScheduleEntry {
  date: string;
  title: string;
  status: 'scheduled' | 'cancelled' | 'full' | 'unknown';
  note: string | null;
}

export interface WeatherDay {
  date: string;
  tmax: number;
  tmin: number;
  precip_prob: number;
  weather_code: number;
  summary: string;
}

export interface FieldUpdate {
  field_id: string;
  fetched_at: string;
  fetch_ok: boolean;
  fetch_error: string | null;
  upcoming_schedule: ScheduleEntry[];
  recent_cancellations: ScheduleEntry[];
  latest_news: string | null;
  image_urls: string[];
  weather: WeatherDay[];
}

export interface UpdatesFile {
  last_updated: string;
  updates: Record<string, FieldUpdate>;
}
