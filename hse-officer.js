const COMMON_STAGE_1_DOCUMENTS = [
  { key: 'MOS', label: 'Method Statement / MOS' },
  { key: 'JSA', label: 'JSA' },
  { key: 'ERP', label: 'Emergency Response Plan' },
];

const PERMIT_TYPE_RULES = {
  'Hot Work': {
    documents: [{ key: 'HOT_WORK_CHECKLIST', label: 'Hot Work checklist or fire watch plan' }],
    competencies: [{ key: 'HOT_WORK', label: 'Hot Work competency' }],
    controls: ['fire watch', 'extinguisher', 'gas test', 'spark containment'],
    stage2: ['gasTestValid', 'fireWatchAssigned', 'barricadingVerified'],
  },
  'Confined Space': {
    documents: [
      { key: 'CONFINED_SPACE_ENTRY', label: 'Confined Space entry permit or entry plan' },
      { key: 'RESCUE_PLAN', label: 'Confined Space rescue plan' },
    ],
    competencies: [
      { key: 'AGTES', label: 'AGTES / authorized gas tester competency' },
      { key: 'CONFINED_SPACE', label: 'Confined Space competency' },
    ],
    controls: ['standby', 'gas', 'ventilation', 'rescue'],
    stage2: ['gasTestValid', 'standbyPersonAssigned', 'rescueEquipmentReady', 'ventilationVerified'],
  },
  'Work at Height': {
    documents: [{ key: 'WAH_PLAN', label: 'Working at Height fall protection plan' }],
    competencies: [{ key: 'WAH', label: 'Working at Height competency' }],
    controls: ['harness', 'lifeline', 'guardrail', 'scaffold', 'tie-off'],
    stage2: ['scaffoldInspectionValid', 'barricadingVerified'],
  },
  'Electrical Isolation': {
    documents: [
      { key: 'LOTO_PLAN', label: 'LOTO / electrical isolation plan' },
      { key: 'ELECTRICAL_CERTIFICATE', label: 'Electrical isolation certificate' },
    ],
    competencies: [
      { key: 'CHARGEMAN', label: 'Chargeman / electrical competent person certificate' },
      { key: 'LOTO', label: 'LOTO competency' },
    ],
    controls: ['loto', 'isolation', 'test for dead', 'arc flash'],
    stage2: ['lotoVerified'],
  },
  Lifting: {
    documents: [{ key: 'LIFTING_PLAN', label: 'Lifting plan' }],
    competencies: [{ key: 'LIFTING', label: 'Lifting supervisor / rigger competency' }],
    controls: ['lifting plan', 'exclusion zone', 'rigging', 'load chart'],
    stage2: ['liftingExclusionZoneVerified'],
  },
  Excavation: {
    documents: [
      { key: 'EXCAVATION_PERMIT', label: 'Excavation permit' },
      { key: 'UTILITY_SCAN', label: 'Underground services scan / utility clearance' },
    ],
    competencies: [{ key: 'EXCAVATION', label: 'Excavation competent person' }],
    controls: ['shoring', 'barricade', 'utility', 'slope', 'benching'],
    stage2: ['excavationProtectionVerified', 'barricadingVerified'],
  },
  Chemical: {
    documents: [{ key: 'SDS', label: 'Safety Data Sheet / chemical handling procedure' }],
    competencies: [{ key: 'CHEMICAL', label: 'Chemical handling competency' }],
    controls: ['sds', 'spill', 'eyewash', 'chemical gloves', 'ventilation'],
    stage2: ['chemicalControlsVerified'],
  },
  'Line Breaking': {
    documents: [
      { key: 'ISOLATION_PLAN', label: 'Line isolation / depressurization plan' },
      { key: 'SDS', label: 'SDS or exposure controls for residual contents' },
    ],
    competencies: [
      { key: 'LINE_BREAKING', label: 'Line Breaking competency' },
      { key: 'LOTO', label: 'LOTO competency' },
    ],
    controls: ['isolation', 'drain', 'depressurize', 'spill', 'blind'],
    stage2: ['lotoVerified', 'chemicalControlsVerified'],
  },
  'General Maintenance': {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
  'Preventive Maintenance': {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
  'Corrective Maintenance': {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
  Housekeeping: {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
  'Predictive Maintenance': {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
  Project: {
    documents: [],
    competencies: [{ key: 'SAFETY_INDUCTION', label: 'Safety induction' }],
    controls: ['barricade', 'ppe', 'toolbox'],
    stage2: ['barricadingVerified'],
  },
};

const DOCUMENT_MATCHERS = {
  MOS: [/^MOS$/i, /method statement/i, /method of statement/i, /\bmos\b/i],
  HIRARC: [/hirarc/i, /hazard identification/i, /risk assessment/i],
  JSA: [/\bjsa\b/i, /job safety analysis/i],
  ERP: [/\berp\b/i, /emergency response/i, /emergency plan/i],
  HOT_WORK_CHECKLIST: [/hot work/i, /fire watch/i],
  CONFINED_SPACE_ENTRY: [/confined space/i, /entry permit/i],
  RESCUE_PLAN: [/rescue plan/i, /rescue procedure/i],
  WAH_PLAN: [/working at height/i, /\bwah\b/i, /fall protection/i],
  LOTO_PLAN: [/loto/i, /lockout/i, /tagout/i, /isolation plan/i],
  ELECTRICAL_CERTIFICATE: [/electrical isolation/i, /chargeman/i, /competent electrical/i],
  LIFTING_PLAN: [/lifting plan/i, /rigging plan/i, /crane lift/i],
  EXCAVATION_PERMIT: [/excavation/i, /digging permit/i],
  UTILITY_SCAN: [/utility/i, /underground services/i, /cable scan/i],
  SDS: [/\bsds\b/i, /safety data sheet/i, /chemical handling/i],
  ISOLATION_PLAN: [/isolation/i, /depressuri[sz]ation/i, /line breaking/i],
};

const COMPETENCY_MATCHERS = {
  HOT_WORK: [/hot work/i, /welder/i],
  AGTES: [/\bagtes\b/i, /authorized gas tester/i, /gas test/i],
  CONFINED_SPACE: [/confined space/i, /entrant/i, /attendant/i],
  WAH: [/work at height/i, /working at height/i, /\bwah\b/i, /height work/i],
  CHARGEMAN: [/chargeman/i, /competent electrical/i, /electrical supervisor/i],
  LOTO: [/loto/i, /lockout/i, /tagout/i, /isolation/i],
  LIFTING: [/lifting/i, /rigger/i, /signalman/i, /crane/i],
  EXCAVATION: [/excavation/i, /shoring/i],
  CHEMICAL: [/chemical/i, /sds/i, /hazmat/i],
  LINE_BREAKING: [/line breaking/i, /line break/i],
  SAFETY_INDUCTION: [/safety induction/i, /site induction/i],
};

function normalizeString(value) {
  return String(value || '').trim();
}

function compactArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitList(item));
  }

  return normalizeString(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAssignedWorkers(value) {
  const seen = new Set();
  return compactArray(value).filter((workerId) => {
    const key = workerId.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalDocumentType(type, name = '') {
  const source = `${type || ''} ${name || ''}`;
  const match = Object.entries(DOCUMENT_MATCHERS).find(([, patterns]) =>
    patterns.some((pattern) => pattern.test(source)),
  );

  return match ? match[0] : normalizeString(type).toUpperCase();
}

function extractDocumentsFromDescription(description) {
  const documents = [];
  const pattern =
    /^(MOS|Method Statement|HIRARC|JSA|RAMS|SWP|ERP|Gas Test|LOTO|Scaffold Inspection|Hot Work Checklist|SDS|Lifting Plan|Excavation Permit|Rescue Plan):\s*(.+)$/gim;
  let match = pattern.exec(String(description || ''));

  while (match) {
    documents.push({
      type: match[1],
      name: match[2].trim(),
    });
    match = pattern.exec(String(description || ''));
  }

  return documents;
}

function normalizePermitDocuments(documents, description = '') {
  const normalized = new Map();
  const sources = [
    ...(Array.isArray(documents) ? documents : splitList(documents)),
    ...extractDocumentsFromDescription(description),
  ];

  sources.forEach((document) => {
    const source =
      typeof document === 'string'
        ? { type: canonicalDocumentType('', document), name: document }
        : {
            id: document?.id,
            type: document?.type,
            name: document?.name || document?.fileName || document?.filename,
            fileName: document?.fileName || document?.filename,
            mimeType: document?.mimeType || document?.attachmentMimeType,
            attachmentData: document?.attachmentData || document?.fileData || document?.contentBase64,
            attachmentPath: document?.attachmentPath,
            hasAttachment: Boolean(document?.hasAttachment || document?.attachmentData || document?.attachmentPath),
            source: document?.source,
            templateVersion: document?.templateVersion,
            structuredData:
              document?.structuredData && typeof document.structuredData === 'object' && !Array.isArray(document.structuredData)
                ? document.structuredData
                : null,
          };
    const name = normalizeString(source.name);
    const type = canonicalDocumentType(source.type, name);

    if (type && name) {
      const key = `${type}:${name.toLowerCase()}`;
      const existing = normalized.get(key) || {};
      normalized.set(key, {
        ...existing,
        type,
        name,
        ...(normalizeString(source.id) ? { id: normalizeString(source.id) } : {}),
        ...(normalizeString(source.fileName) ? { fileName: normalizeString(source.fileName) } : {}),
        ...(normalizeString(source.mimeType) ? { mimeType: normalizeString(source.mimeType) } : {}),
        ...(normalizeString(source.attachmentData)
          ? { attachmentData: normalizeString(source.attachmentData), hasAttachment: true }
          : {}),
        ...(normalizeString(source.attachmentPath)
          ? { attachmentPath: normalizeString(source.attachmentPath), hasAttachment: true }
          : {}),
        ...(source.hasAttachment ? { hasAttachment: true } : {}),
        ...(normalizeString(source.source) ? { source: normalizeString(source.source) } : {}),
        ...(normalizeString(source.templateVersion) ? { templateVersion: normalizeString(source.templateVersion) } : {}),
        ...(source.structuredData ? { structuredData: source.structuredData } : {}),
      });
    }
  });

  return Array.from(normalized.values());
}

function extractPermitType(permit) {
  const explicitType = normalizeString(permit?.workType || permit?.permitType);
  if (explicitType) {
    return canonicalPermitType(explicitType);
  }

  const description = String(permit?.description || '');
  const match = description.match(/Permit Type:\s*([^\n]+)/i);
  if (match) {
    return canonicalPermitType(match[1]);
  }

  const source = [
    permit?.title,
    permit?.location,
    description,
    ...(Array.isArray(permit?.hazards) ? permit.hazards : []),
  ]
    .join(' ')
    .toLowerCase();

  if (source.includes('corrective') || source.includes('repair') || source.includes('breakdown')) {
    return 'Corrective Maintenance';
  }
  if (source.includes('housekeeping') || source.includes('cleaning')) return 'Housekeeping';
  if (source.includes('predictive') || source.includes('condition monitoring')) {
    return 'Predictive Maintenance';
  }
  if (source.includes('project') || source.includes('tie-in')) return 'Project';
  if (source.includes('preventive') || source.includes('inspection')) return 'Preventive Maintenance';
  if (source.includes('hot') || source.includes('weld')) return 'Hot Work';
  if (source.includes('confined') || source.includes('vessel') || source.includes('tank')) {
    return 'Confined Space';
  }
  if (source.includes('electrical') || source.includes('substation') || source.includes('loto')) {
    return 'Electrical Isolation';
  }
  if (source.includes('height') || source.includes('scaffold') || source.includes('roof')) {
    return 'Work at Height';
  }
  if (source.includes('lift') || source.includes('crane') || source.includes('rigging')) {
    return 'Lifting';
  }
  if (source.includes('excavat') || source.includes('trench')) return 'Excavation';
  if (source.includes('line break')) return 'Line Breaking';
  if (source.includes('chemical') || source.includes('sds')) return 'Chemical';
  return 'Preventive Maintenance';
}

function canonicalPermitType(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized.includes('preventive')) return 'Preventive Maintenance';
  if (normalized.includes('corrective')) return 'Corrective Maintenance';
  if (normalized.includes('housekeeping')) return 'Housekeeping';
  if (normalized.includes('predictive')) return 'Predictive Maintenance';
  if (normalized.includes('project')) return 'Project';
  if (normalized.includes('hot')) return 'Hot Work';
  if (normalized.includes('confined')) return 'Confined Space';
  if (normalized.includes('electrical') || normalized.includes('isolation')) {
    return 'Electrical Isolation';
  }
  if (normalized.includes('height') || normalized === 'wah') return 'Work at Height';
  if (normalized.includes('lift')) return 'Lifting';
  if (normalized.includes('excavat')) return 'Excavation';
  if (normalized.includes('line break')) return 'Line Breaking';
  if (normalized.includes('chemical')) return 'Chemical';
  return value in PERMIT_TYPE_RULES ? value : 'Preventive Maintenance';
}

function hasDocument(documents, requirementKey) {
  const matchers = DOCUMENT_MATCHERS[requirementKey] || [new RegExp(requirementKey, 'i')];
  return documents.some((document) => {
    if (canonicalDocumentType(document.type, document.name) === requirementKey) {
      return true;
    }

    const source = `${document.type || ''} ${document.name || ''}`;
    return matchers.some((pattern) => pattern.test(source));
  });
}

function resolveAssignedWorkers(permit, workers) {
  const assignedWorkerIds = normalizeAssignedWorkers(permit.assignedWorkers);
  return assignedWorkerIds.map((workerId) => {
    const normalizedWorkerId = workerId.toLowerCase();
    const worker = workers.find((item) =>
      [item.id, item.employeeId, item.employee_id, item.name, item.email]
        .map((value) => normalizeString(value).toLowerCase())
        .includes(normalizedWorkerId),
    );

    return { workerId, worker };
  });
}

function isWorkerExpired(worker, now = new Date()) {
  if (!worker) {
    return false;
  }

  if (String(worker.status || '').toLowerCase() === 'expired') {
    return true;
  }

  if (!worker.expiry) {
    return false;
  }

  const expiry = new Date(worker.expiry);
  return !Number.isNaN(expiry.getTime()) && expiry < now;
}

function workerHasCompetency(worker, competencyKey) {
  if (!worker) {
    return false;
  }

  const matchers = COMPETENCY_MATCHERS[competencyKey] || [new RegExp(competencyKey, 'i')];
  const source = [
    worker.name,
    worker.role,
    ...(Array.isArray(worker.permits) ? worker.permits : []),
    ...(Array.isArray(worker.qualifications) ? worker.qualifications : []),
    ...(Array.isArray(worker.certs)
      ? worker.certs.flatMap((cert) => [cert.name, cert.status, cert.detail])
      : []),
  ].join(' ');

  return matchers.some((pattern) => pattern.test(source));
}

function hasStepBasedJsaEvidence(permit) {
  const source = [
    permit.description,
    ...(Array.isArray(permit.controls) ? permit.controls : []),
  ].join('\n');

  const stepMatches = source.match(/\b(step|activity|task)\s*\d+|\b\d+\.\s+\S+/gi) || [];
  return stepMatches.length >= 2;
}

function includesAny(values, words) {
  const source = (Array.isArray(values) ? values : splitList(values)).join(' ').toLowerCase();
  return words.some((word) => source.includes(word.toLowerCase()));
}

function hasProhibitedMethod(permit) {
  const source = [
    permit.title,
    permit.description,
    ...(Array.isArray(permit.controls) ? permit.controls : []),
  ]
    .join(' ')
    .toLowerCase();

  return [
    /bypass\s+loto/,
    /without\s+isolation/,
    /without\s+gas\s+test/,
    /no\s+ppe/,
    /enter\s+confined\s+space\s+without/,
    /live\s+electrical\s+work\s+without/,
  ].some((pattern) => pattern.test(source));
}

function getRequiredDocuments(permitType) {
  return [...COMMON_STAGE_1_DOCUMENTS, ...(PERMIT_TYPE_RULES[permitType]?.documents || [])];
}

function getRequiredCompetencies(permitType) {
  return PERMIT_TYPE_RULES[permitType]?.competencies || [];
}

function evaluateStage1(permit, workers, now) {
  const flags = [];
  const permitType = extractPermitType(permit);
  const documents = normalizePermitDocuments(permit.documents, permit.description);
  const assignedWorkers = resolveAssignedWorkers(permit, workers);
  const controls = compactArray(permit.controls);
  const hazards = compactArray(permit.hazards);

  getRequiredDocuments(permitType).forEach((requirement) => {
    if (!hasDocument(documents, requirement.key)) {
      flags.push(`${requirement.label} is missing for ${permitType}.`);
    }
  });

  if (!hazards.length) {
    flags.push('Permit type register is missing; no permit type entries are recorded against the permit.');
  }

  if (!controls.length) {
    flags.push('JSA/SWP controls are missing; no mitigation controls are recorded against the permit.');
  }

  if (hazards.length && controls.length < hazards.length) {
    flags.push(
      `JSA control mapping is incomplete; ${hazards.length} hazard(s) are listed but only ${controls.length} control item(s) are recorded.`,
    );
  }

  const expectedControls = PERMIT_TYPE_RULES[permitType]?.controls || [];
  if (expectedControls.length && !includesAny(controls, expectedControls)) {
    flags.push(
      `${permitType} controls do not include expected critical controls: ${expectedControls.join(', ')}.`,
    );
  }

  if (!hasStepBasedJsaEvidence(permit)) {
    flags.push(
      'JSA job-step breakdown is not evidenced; provide sequential job steps with hazards and controls mapped to each step.',
    );
  }

  if (!assignedWorkers.length) {
    flags.push('Worker list is missing; no assigned workers are available for competency verification.');
  }

  assignedWorkers.forEach(({ workerId, worker }) => {
    if (!worker) {
      flags.push(`Assigned worker "${workerId}" is not found in the competency register.`);
      return;
    }

    if (isWorkerExpired(worker, now)) {
      flags.push(`Assigned worker ${worker.name || workerId} has expired or invalid competency status.`);
    }
  });

  getRequiredCompetencies(permitType).forEach((requirement) => {
    const hasCompetentWorker = assignedWorkers.some(
      ({ worker }) => worker && !isWorkerExpired(worker, now) && workerHasCompetency(worker, requirement.key),
    );

    if (!hasCompetentWorker) {
      flags.push(`${requirement.label} is missing from the assigned worker list for ${permitType}.`);
    }
  });

  const decision = hasProhibitedMethod(permit)
    ? 'Rejected'
    : flags.length
      ? 'Return for Correction'
      : 'Approved';

  return createEvaluation({
    stage: permit.isEmergency ? 'Emergency' : 'MOS Approval',
    decision,
    flags,
    permitType,
  });
}

function normalizeDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function getBooleanValidation(siteValidation, keys) {
  return keys.some((key) => siteValidation[key] === true);
}

function evaluateStage2(permit, workers, activePermits, siteValidation = {}) {
  const flags = [];
  const permitType = extractPermitType(permit);
  const assignedWorkers = normalizeAssignedWorkers(permit.assignedWorkers);
  const attendance = normalizeAssignedWorkers(
    siteValidation.attendance || siteValidation.attendees || siteValidation.workerAttendance,
  );
  const actualDate = siteValidation.actualWorkDate || siteValidation.workDate || siteValidation.date;
  const actualLocation = normalizeString(siteValidation.location || siteValidation.workLocation);
  const plannedDate = normalizeDateOnly(permit.startDateTime);

  if (!actualDate || normalizeDateOnly(actualDate) !== plannedDate) {
    flags.push(
      `Actual work date is not verified against the approved schedule date ${plannedDate || permit.startDateTime}.`,
    );
  }

  if (!actualLocation || actualLocation.toLowerCase() !== normalizeString(permit.location).toLowerCase()) {
    flags.push(`Actual work location does not match approved permit location "${permit.location}".`);
  }

  if (!attendance.length) {
    flags.push('Attendance list is missing for site validation.');
  } else if (assignedWorkers.length) {
    const attendanceSet = new Set(attendance.map((item) => item.toLowerCase()));
    const missing = assignedWorkers.filter((workerId) => !attendanceSet.has(workerId.toLowerCase()));
    if (missing.length) {
      flags.push(`Attendance does not match approved worker list; missing worker(s): ${missing.join(', ')}.`);
    }
  }

  if (!getBooleanValidation(siteValidation, ['toolboxTalkCompleted', 'tbtCompleted'])) {
    flags.push('Toolbox Talk is not documented as completed for all attending workers.');
  }

  if (!getBooleanValidation(siteValidation, ['ppeVerified', 'ppeCompliant'])) {
    flags.push('PPE compliance checklist is not verified.');
  }

  const stage2Requirements = PERMIT_TYPE_RULES[permitType]?.stage2 || [];
  stage2Requirements.forEach((key) => {
    if (siteValidation[key] !== true) {
      flags.push(`${formatValidationKey(key)} is not verified for ${permitType}.`);
    }
  });

  detectPermitConflicts(permit, activePermits).forEach((conflict) => flags.push(conflict));

  const decision = hasProhibitedMethod(permit)
    ? 'Rejected'
    : flags.length
      ? 'Return for Correction'
      : 'Approved';

  return createEvaluation({
    stage: permit.isEmergency ? 'Emergency' : 'Permit Approval',
    decision,
    flags,
    permitType,
  });
}

function formatValidationKey(key) {
  const labels = {
    gasTestValid: 'Gas Test result',
    fireWatchAssigned: 'Fire watch assignment',
    barricadingVerified: 'Barricading and signage',
    standbyPersonAssigned: 'Standby person',
    rescueEquipmentReady: 'Rescue equipment',
    ventilationVerified: 'Ventilation',
    scaffoldInspectionValid: 'Scaffold inspection',
    lotoVerified: 'LOTO isolation',
    liftingExclusionZoneVerified: 'Lifting exclusion zone',
    excavationProtectionVerified: 'Excavation protection',
    chemicalControlsVerified: 'Chemical controls',
  };

  return labels[key] || key;
}

function detectPermitConflicts(permit, activePermits = []) {
  const conflicts = [];
  const permitStart = new Date(permit.startDateTime);
  const permitEnd = new Date(permit.endDateTime);
  const permitHazards = compactArray(permit.hazards).join(' ').toLowerCase();

  activePermits.forEach((activePermit) => {
    if (activePermit.id === permit.id) {
      return;
    }

    const activeStart = new Date(activePermit.startDateTime);
    const activeEnd = new Date(activePermit.endDateTime);
    const datesOverlap =
      !Number.isNaN(permitStart.getTime()) &&
      !Number.isNaN(permitEnd.getTime()) &&
      !Number.isNaN(activeStart.getTime()) &&
      !Number.isNaN(activeEnd.getTime()) &&
      permitStart <= activeEnd &&
      activeStart <= permitEnd;
    const sameLocation =
      normalizeString(activePermit.location).toLowerCase() ===
      normalizeString(permit.location).toLowerCase();

    if (!datesOverlap || !sameLocation) {
      return;
    }

    const activeHazards = compactArray(activePermit.hazards).join(' ').toLowerCase();
    const chemicalFireConflict =
      (permitHazards.includes('hot') && activeHazards.includes('chemical')) ||
      (permitHazards.includes('chemical') && activeHazards.includes('hot'));

    conflicts.push(
      chemicalFireConflict
        ? `Active permit conflict detected at ${permit.location}: hot work overlaps with chemical hazard permit ${activePermit.id}.`
        : `Spatial overlap detected with active permit ${activePermit.id} at ${permit.location}.`,
    );
  });

  return conflicts;
}

function createEvaluation({ stage, decision, flags, permitType }) {
  return {
    evaluation_stage: stage,
    decision,
    flags_detected: flags,
    detailed_feedback: buildFeedback(stage, decision, flags, permitType),
    next_workflow_step: getNextWorkflowStep(stage, decision),
  };
}

function buildFeedback(stage, decision, flags, permitType) {
  if (decision === 'Approved') {
    if (stage === 'MOS Approval') {
      return `MOS Approved for ${permitType}. Required methodology, hazard controls, document evidence, and competency checks are recorded sufficiently for routing to work scheduling.`;
    }

    return `${stage} Approved for ${permitType}. Site date, location, attendance, TBT, and permit-specific execution controls are verified for the work day.`;
  }

  if (decision === 'Rejected') {
    return `The ${permitType} submission contains a fundamentally unsafe work method and is rejected. The contractor must stop this submission path and provide a complete revised method that removes the prohibited condition before any new review. Specific issue(s): ${flags.join(' ')}`;
  }

  return `The ${permitType} permit is returned for correction. The contractor must address each deficiency before resubmission: ${flags.join(' ')}`;
}

function getNextWorkflowStep(stage, decision) {
  if (decision === 'Approved') {
    if (stage === 'MOS Approval') {
      return 'Work Scheduling';
    }

    return 'Execution Approved for Day';
  }

  if (decision === 'Rejected') {
    return 'Rejected/Stop Work';
  }

  return stage === 'Permit Approval' ? 'Submitted/Draft' : 'Return/Draft';
}

function canonicalEvaluationStage(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'stage 1' || normalized.includes('mos')) return 'MOS Approval';
  if (normalized === 'stage 2' || normalized.includes('permit approval') || normalized.includes('execution')) {
    return 'Permit Approval';
  }
  if (normalized.includes('emergency')) return 'Emergency';
  return value;
}

function buildHseEvaluation({ permit, workers = [], activePermits = [], evaluationStage, siteValidation }) {
  const requestedStage = canonicalEvaluationStage(evaluationStage);
  const inferredStage = permit.isEmergency
    ? 'Emergency'
    : permit.status === 'stage1_complete' || permit.status === 'approved'
      ? 'Permit Approval'
      : 'MOS Approval';
  const stage = requestedStage || inferredStage;

  if (stage === 'Permit Approval') {
    return evaluateStage2(permit, workers, activePermits, siteValidation);
  }

  if (stage === 'Emergency') {
    const stage1 = evaluateStage1({ ...permit, isEmergency: true }, workers, new Date());
    const stage2 = evaluateStage2(
      { ...permit, isEmergency: true },
      workers,
      activePermits,
      siteValidation || {},
    );
    const flags = [...stage1.flags_detected, ...stage2.flags_detected];
    const decision =
      stage1.decision === 'Rejected' || stage2.decision === 'Rejected'
        ? 'Rejected'
        : flags.length
          ? 'Return for Correction'
          : 'Approved';

    return createEvaluation({
      stage: 'Emergency',
      decision,
      flags,
      permitType: extractPermitType(permit),
    });
  }

  return evaluateStage1(permit, workers, new Date());
}

function mapHseDecisionToStatus(evaluation) {
  if (evaluation.decision === 'Approved') {
    return evaluation.evaluation_stage === 'MOS Approval' ? 'stage1_complete' : 'approved';
  }

  return 'rejected';
}

module.exports = {
  buildHseEvaluation,
  extractPermitType,
  mapHseDecisionToStatus,
  normalizeAssignedWorkers,
  normalizePermitDocuments,
};
