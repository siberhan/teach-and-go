// Pure schedule math: weekly slots (incl. twice a day), every N days, start date, multi-lesson topics, old lessonDays plans.
const { lessonTimes, scheduleRows, describeSchedule, scheduleOf } = await import('../src/lib/schedule.ts')
const mon = new Date(2026, 9, 26) // Monday
const fmt = (xs) => xs.map((x) => `${x.date.getDate()}${x.time ? '@' + x.time : ''}`).join(' ')
const r = {
  weekly: fmt(lessonTimes({ slots: [{ day: 'Fri', time: '19:00' }, { day: 'Tue', time: '19:00' }] }, mon, 4)),
  twiceSat: fmt(lessonTimes({ slots: [{ day: 'Sat', time: '15:00' }, { day: 'Sat', time: '10:00' }] }, mon, 3)),
  every2: fmt(lessonTimes({ everyDays: 2, times: ['10:00'] }, mon, 3)),
  every2Start: fmt(lessonTimes({ everyDays: 2, startDate: '2026-10-25' }, mon, 3)),
  fromNextWeek: fmt(lessonTimes({ slots: [{ day: 'Tue' }], startDate: '2026-11-03' }, mon, 2)),
  describe: describeSchedule({ slots: [{ day: 'Fri', time: '19:00' }, { day: 'Tue', time: '19:00' }], startDate: '2026-11-03' }),
  old: describeSchedule(scheduleOf({ summary: '', lessonDays: ['Mon', 'Thu'], topics: [] })),
}
const plan = { summary: '', schedule: { slots: [{ day: 'Tue' }, { day: 'Fri' }] }, topics: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B', lessons: 2 }, { id: 'c', title: 'C' }] }
r.rows = scheduleRows(plan, 1, mon).map((x) => `${x.topic.id}:${x.state}:${x.when ? x.when.date.getDate() : '-'}:${x.estimated}`).join(' ')
console.log(r)
const ok =
  r.weekly === '27@19:00 30@19:00 3@19:00 6@19:00' &&
  r.twiceSat === '31@10:00 31@15:00 7@10:00' &&
  r.every2 === '26@10:00 28@10:00 30@10:00' &&
  r.every2Start === '27 29 31' &&
  r.fromNextWeek === '3 10' &&
  /^Tue 19:00 · Fri 19:00 · from /.test(r.describe) &&
  r.old === 'Mon · Thu' &&
  r.rows === 'a:done:-:false b:next:27:true c:later:3:true'
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
