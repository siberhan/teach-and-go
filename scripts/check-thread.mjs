// Slice 4 check: the Thread card shows a deferred topic only when it belongs to the next topic.
import assert from 'node:assert/strict'
import { nextTopic, threadCard } from '../src/lib/thread.ts'

const plan = { summary: '', topics: [{ id: 'a', title: 'Rules' }, { id: 'b', title: 'Chain rule' }, { id: 'c', title: 'Integrals' }] }
const lesson = (over) => ({ id: 'l1', spaceId: 's', createdAt: 1, durationSec: 60, status: 'done', ...over })

assert.equal(nextTopic(plan, undefined).id, 'a')
assert.equal(nextTopic(plan, { text: 'x', topicId: 'a', topicFinished: true }).id, 'b')
assert.equal(nextTopic(plan, { text: 'x', topicId: 'a', topicFinished: false }).id, 'a')

const finished = lesson({ stoppingPoint: { text: 'quotient rule done', topicId: 'a', topicFinished: true }, deferred: [{ id: 'd1', text: 'chain rule', topicId: 'b' }, { id: 'd2', text: 'u-substitution', topicId: 'c' }] })
let card = threadCard(plan, [finished])
assert.equal(card.startAt, 'Chain rule')
assert.deepEqual(card.reminders.map((d) => d.id), ['d1']) // matches next topic
assert.deepEqual(card.waiting.map((d) => d.id), ['d2']) // waits for its own lesson

card = threadCard(plan, [lesson({ stoppingPoint: { text: 'mid product rule', topicId: 'a', topicFinished: false }, deferred: finished.deferred })])
assert.equal(card.startAt, 'mid product rule')
assert.equal(card.reminders.length, 0)

card = threadCard(plan, [finished, lesson({ id: 'l0', status: 'analyzing', createdAt: 2 })])
assert.equal(card.kind, 'continue') // analyzing lessons don't replace the last finished one
assert.equal(threadCard(undefined, []).kind, 'setup')
assert.equal(threadCard(plan, []).kind, 'first')
console.log('PASS')

// Slice 6: upcoming lessons and space order.
const { nextLessonDate, upcomingLessons, sortSpaces } = await import('../src/lib/thread.ts')
const mon = new Date(2026, 9, 26) // Monday
assert.equal(nextLessonDate({ ...plan, lessonDays: ['Mon'] }, mon).getDate(), 26) // today counts
assert.equal(nextLessonDate({ ...plan, lessonDays: ['Fri'] }, mon).getDate(), 30)
assert.equal(nextLessonDate({ summary: '', topics: [{ id: 'x', title: 'A', date: '2026-10-20' }, { id: 'y', title: 'B', date: '2026-11-02' }] }, mon).getDate(), 2)
assert.equal(nextLessonDate(plan, mon), undefined)
const spaces = [
  { id: 'a', name: 'Fri kid', createdAt: 3, plan: { ...plan, lessonDays: ['Fri'] } },
  { id: 'b', name: 'No days', createdAt: 9 },
  { id: 'c', name: 'Tue kid', createdAt: 1, plan: { ...plan, lessonDays: ['Tue'] } },
]
assert.deepEqual(sortSpaces(spaces, mon).map((s) => s.id), ['c', 'a', 'b'])
const up = upcomingLessons(spaces, [{ ...finished, spaceId: 'c' }], mon)
assert.deepEqual(up.map((u) => [u.spaceId, u.topic]), [['c', 'Chain rule'], ['a', 'Rules']])
console.log('PASS upcoming')
