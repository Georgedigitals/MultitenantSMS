export interface DayOfWeekItem {
  day: number;
  name: string;
  short: string;
}

export const DAYS_OF_WEEK: DayOfWeekItem[] = [
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
];

export interface DefaultPeriodTemplate {
  name: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
  isBreak: boolean;
}

export const DEFAULT_PERIODS: DefaultPeriodTemplate[] = [
  { name: 'Morning Assembly', startTime: '07:45', endTime: '08:00', orderIndex: 1, isBreak: true },
  { name: 'Period 1', startTime: '08:00', endTime: '08:45', orderIndex: 2, isBreak: false },
  { name: 'Period 2', startTime: '08:45', endTime: '09:30', orderIndex: 3, isBreak: false },
  { name: 'Short Break', startTime: '09:30', endTime: '10:00', orderIndex: 4, isBreak: true },
  { name: 'Period 3', startTime: '10:00', endTime: '10:45', orderIndex: 5, isBreak: false },
  { name: 'Period 4', startTime: '10:45', endTime: '11:30', orderIndex: 6, isBreak: false },
  { name: 'Lunch Break', startTime: '11:30', endTime: '12:15', orderIndex: 7, isBreak: true },
  { name: 'Period 5', startTime: '12:15', endTime: '13:00', orderIndex: 8, isBreak: false },
  { name: 'Period 6', startTime: '13:00', endTime: '13:45', orderIndex: 9, isBreak: false },
  { name: 'Period 7', startTime: '13:45', endTime: '14:30', orderIndex: 10, isBreak: false },
];
