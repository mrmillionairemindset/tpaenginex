export const SERVICE_TYPE_CHECKLISTS: Record<string, string[]> = {
  post_accident: [
    'Rapid Drug Test',
    'Lab-Based Drug Test',
    'Breath Alcohol Test (BAT)',
    'Collect specimens and label',
    'Complete Chain of Custody Form',
    'Notify MRO of pending results',
  ],
  reasonable_suspicion: [
    'Verify supervisor documentation',
    'Rapid Drug Test',
    'Lab-Based Drug Test',
    'Breath Alcohol Test (BAT)',
    'Complete Chain of Custody Form',
    'Notify MRO of pending results',
  ],
  random: [
    'Verify selection list from consortium',
    'Confirm collection window deadline',
    'Notify MRO of pending results',
    'Drug Test collection',
    'Complete Chain of Custody Form',
    'Submit specimens to lab',
  ],
  pre_employment: [
    'Drug Test collection',
    'Complete Chain of Custody Form',
    'Submit specimens to lab',
  ],
  physical: [
    'DOT Physical Examination',
    'Vision Test',
    'Hearing Test',
    'Blood Pressure Check',
    'Complete medical certificate',
  ],
  other: [],
  drug_screen: [
    'Drug Test collection',
    'Complete Chain of Custody Form',
    'Submit specimens to lab',
  ],
};
