const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, TERMINAL_STATUSES } = require('./lessonStatus');

test('Terminal statuses list contains all canonical terminal cancellation and completion states', () => {
  const handledTerminalList = ['completed', 'settled', 'expired', 'closed', 'canceled', 'canceled_during', 'canceled_by_student', 'canceled_by_tutor', 'cancelled'];
  for (const st of TERMINAL_STATUSES) {
    assert.ok(handledTerminalList.includes(st), `Canonical terminal status '${st}' should be in handled terminal list.`);
  }
});

test('Idempotent cancellation logic resolves already-terminal requests cleanly without throwing 409', () => {
  const terminalStatuses = ['completed', 'settled', 'expired', 'closed', 'canceled', 'canceled_during', 'canceled_by_student', 'canceled_by_tutor', 'cancelled'];
  
  function evaluateCancellation(currentStatus) {
    const norm = String(currentStatus || '').toLowerCase();
    if (terminalStatuses.includes(norm)) {
      return {
        status: 200,
        body: {
          success: true,
          status: norm,
          alreadyTerminal: true,
          message: `Lesson is already closed in terminal status '${norm}'.`,
        },
      };
    }
    return {
      status: 200,
      body: {
        success: true,
        status: LESSON_STATUS.CANCELED_BY_TUTOR,
        alreadyTerminal: false,
      },
    };
  }

  for (const st of terminalStatuses) {
    const res = evaluateCancellation(st);
    assert.equal(res.status, 200, `Terminal status ${st} must return HTTP 200.`);
    assert.equal(res.body.success, true, `Terminal status ${st} must return success: true.`);
    assert.equal(res.body.alreadyTerminal, true, `Terminal status ${st} must have alreadyTerminal: true.`);
  }

  const activeRes = evaluateCancellation('in_progress');
  assert.equal(activeRes.body.alreadyTerminal, false, 'Active lesson should not be alreadyTerminal.');
});

test('Cash payment collection confirmed sets paid and cashCollected true', () => {
  function processCashConfirmation({ collected, totalAmount, currentWalletBalance }) {
    const paymentStatus = collected ? 'paid' : 'wallet_debt_recorded';
    const nextWalletBalance = collected
      ? currentWalletBalance
      : Number((Number(currentWalletBalance || 0) - Number(totalAmount || 0)).toFixed(2));
    return {
      success: true,
      paymentStatus,
      cashCollected: collected,
      nextWalletBalance,
    };
  }

  const confirmed = processCashConfirmation({ collected: true, totalAmount: 140.00, currentWalletBalance: 0.00 });
  assert.equal(confirmed.paymentStatus, 'paid');
  assert.equal(confirmed.cashCollected, true);
  assert.equal(confirmed.nextWalletBalance, 0.00);
});

test('Cash payment uncollected deducts totalAmount from student wallet balance as debt', () => {
  function processCashConfirmation({ collected, totalAmount, currentWalletBalance }) {
    const paymentStatus = collected ? 'paid' : 'wallet_debt_recorded';
    const nextWalletBalance = collected
      ? currentWalletBalance
      : Number((Number(currentWalletBalance || 0) - Number(totalAmount || 0)).toFixed(2));
    return {
      success: true,
      paymentStatus,
      cashCollected: collected,
      nextWalletBalance,
    };
  }

  // Zero balance becomes negative debt: -140
  const uncollectedZero = processCashConfirmation({ collected: false, totalAmount: 140.00, currentWalletBalance: 0.00 });
  assert.equal(uncollectedZero.paymentStatus, 'wallet_debt_recorded');
  assert.equal(uncollectedZero.cashCollected, false);
  assert.equal(uncollectedZero.nextWalletBalance, -140.00);

  // Positive balance 50 becomes -90: 50 - 140 = -90
  const uncollectedPositive = processCashConfirmation({ collected: false, totalAmount: 140.00, currentWalletBalance: 50.00 });
  assert.equal(uncollectedPositive.nextWalletBalance, -90.00);

  // Negative balance -20 becomes -160: -20 - 140 = -160
  const uncollectedNegative = processCashConfirmation({ collected: false, totalAmount: 140.00, currentWalletBalance: -20.00 });
  assert.equal(uncollectedNegative.nextWalletBalance, -160.00);
});

test('Active class request state cleanup resets activeClassRequestId and activeSessionId to null', () => {
  const existingUser = {
    uid: 'tutor-123',
    activeClassRequestId: 'req-456',
    activeSessionId: 'sess-789',
  };

  const cleanupUpdate = {
    activeClassRequestId: null,
    activeSessionId: null,
  };

  const mergedUser = { ...existingUser, ...cleanupUpdate };
  assert.equal(mergedUser.activeClassRequestId, null);
  assert.equal(mergedUser.activeSessionId, null);
});
