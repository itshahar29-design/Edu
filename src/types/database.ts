export type UserRole = 'owner' | 'admin' | 'teacher' | 'parent' | 'student';
export type AttendanceStatus = 'present' | 'absent' | 'late';

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      schools: Table<{
        id: string; name: string; address: string | null; phone: string | null;
        owner_id: string | null; is_active: boolean; created_at: string; updated_at: string;
      }>;
      profiles: Table<{
        id: string; telegram_id: number; username: string | null; full_name: string;
        phone: string | null; photo_url: string | null; role: UserRole;
        school_id: string | null; is_active: boolean; created_at: string; updated_at: string;
      }, Partial<{
        id: string; telegram_id: number; username: string | null; full_name: string;
        phone: string | null; photo_url: string | null; role: UserRole;
        school_id: string | null; is_active: boolean; created_at: string; updated_at: string;
      }> & { telegram_id: number; full_name: string }>;
      groups: Table<{
        id: string; school_id: string; name: string; teacher_id: string | null;
        is_active: boolean; created_at: string; updated_at: string;
      }, Partial<{
        id: string; school_id: string; name: string; teacher_id: string | null;
        is_active: boolean; created_at: string; updated_at: string;
      }> & { school_id: string; name: string }>;
      students: Table<{
        id: string; school_id: string; group_id: string | null; full_name: string;
        phone: string | null; parent_id: string | null; is_active: boolean;
        created_at: string; updated_at: string;
      }, Partial<{
        id: string; school_id: string; group_id: string | null; full_name: string;
        phone: string | null; parent_id: string | null; is_active: boolean;
        created_at: string; updated_at: string;
      }> & { school_id: string; full_name: string }>;
      attendance: Table<{
        id: string; student_id: string; group_id: string | null; date: string;
        status: AttendanceStatus; recorded_by: string | null;
        created_at: string; updated_at: string;
      }, Partial<{
        id: string; student_id: string; group_id: string | null; date: string;
        status: AttendanceStatus; recorded_by: string | null;
        created_at: string; updated_at: string;
      }> & { student_id: string; date: string; status: AttendanceStatus }>;
    };
    Views: {};
    Functions: {};
    Enums: {
      user_role: UserRole;
      attendance_status: AttendanceStatus;
    };
    CompositeTypes: {};
  };
}
