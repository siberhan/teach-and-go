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
