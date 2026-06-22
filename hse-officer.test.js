const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHseEvaluation,
  mapHseDecisionToStatus,
} = require('./hse-officer');

test('Stage 1 HSE review returns correction when evidence is missing', () => {
  const evaluation = buildHseEvaluation({
    evaluationStage: 'Stage 1',
    permit: {
      title: 'Pump skid welding',
      workType: 'Hot Work',
      location: 'Main Plant',
      description: 'Permit Type: Hot Work\n\nWelding support bracket.',
      hazards: ['Hot Work'],
      controls: ['Fire watch assigned'],
      documents: [{ type: 'HIRARC', name: 'pump-hirarc.pdf' }],
      assignedWorkers: [],
      status: 'submitted',
    },
    workers: [],
  });

  assert.equal(evaluation.evaluation_stage, 'Stage 1');
  assert.equal(evaluation.decision, 'Return for Correction');
  assert.equal(evaluation.next_workflow_step, 'Return/Draft');
  assert.ok(evaluation.flags_detected.some((flag) => flag.includes('Method Statement')));
  assert.ok(evaluation.flags_detected.some((flag) => flag.includes('Worker list')));
});

test('Stage 1 HSE review approves complete hot work evidence', () => {
  const evaluation = buildHseEvaluation({
    evaluationStage: 'Stage 1',
    permit: {
      title: 'Pump skid welding',
      workType: 'Hot Work',
      location: 'Main Plant',
      description: 'Permit Type: Hot Work\nStep 1 set barricade.\nStep 2 weld bracket.',
      hazards: ['Hot Work'],
      controls: [
        '1. Gas test and fire watch assigned before ignition.',
        '2. Fire extinguisher staged and spark containment installed.',
      ],
      documents: [
        { type: 'MOS', name: 'method statement.pdf' },
        { type: 'HIRARC', name: 'pump-hirarc.pdf' },
        { type: 'JSA', name: 'pump-jsa.pdf' },
        { type: 'ERP', name: 'emergency response plan.pdf' },
        { type: 'Hot Work Checklist', name: 'hot work checklist.pdf' },
      ],
      assignedWorkers: ['worker@example.com'],
      status: 'submitted',
    },
    workers: [
      {
        id: 'W01',
        employeeId: 'EMP-001',
        name: 'John Doe',
        email: 'worker@example.com',
        role: 'Senior Welder',
        permits: ['Hot Work', 'Safety Induction'],
        status: 'valid',
        expiry: '2027-12-31',
      },
    ],
  });

  assert.equal(evaluation.decision, 'Approved');
  assert.equal(evaluation.next_workflow_step, 'Work Scheduling');
  assert.equal(mapHseDecisionToStatus(evaluation), 'stage1_complete');
});

test('Stage 1 HSE review accepts canonical hot work checklist document type', () => {
  const evaluation = buildHseEvaluation({
    evaluationStage: 'Stage 1',
    permit: {
      title: 'Pump skid welding',
      workType: 'Hot Work',
      location: 'Main Plant',
      description: 'Permit Type: Hot Work\nStep 1 set barricade.\nStep 2 weld bracket.',
      hazards: ['Hot Work'],
      controls: [
        '1. Gas test and fire watch assigned before ignition.',
        '2. Fire extinguisher staged and spark containment installed.',
      ],
      documents: [
        { type: 'MOS', name: 'method.pdf' },
        { type: 'HIRARC', name: 'hazards.pdf' },
        { type: 'JSA', name: 'job-steps.pdf' },
        { type: 'ERP', name: 'response.pdf' },
        { type: 'HOT_WORK_CHECKLIST', name: 'checklist.pdf' },
      ],
      assignedWorkers: ['W01'],
      status: 'submitted',
    },
    workers: [
      {
        id: 'W01',
        employeeId: 'EMP-001',
        name: 'John Doe',
        role: 'Senior Welder',
        permits: ['Hot Work', 'Safety Induction'],
        status: 'valid',
        expiry: '2027-12-31',
      },
    ],
  });

  assert.equal(evaluation.decision, 'Approved');
});
