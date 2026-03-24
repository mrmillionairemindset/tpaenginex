import { db } from '@/db/client';
import { serviceCatalog, reasonCatalog, panelCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Seed default service catalog, reason catalog, and panel code data for a TPA.
 * Skips if the TPA already has catalog data (idempotent).
 */
export async function seedCatalogForTpa(tpaOrgId: string) {
  // Check if already seeded
  const existing = await db.query.serviceCatalog.findFirst({
    where: eq(serviceCatalog.tpaOrgId, tpaOrgId),
  });
  if (existing) return;

  // =========================================================================
  // REASON CATALOG
  // =========================================================================

  const drugTestingReasons = [
    { name: 'Pre-employment', code: 'pre_employment', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: false, sortOrder: 1 },
    { name: 'Random', code: 'random', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: false, sortOrder: 2 },
    { name: 'Post Accident', code: 'post_accident', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: true, sortOrder: 3 },
    { name: 'Return to Duty', code: 'return_to_duty', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: false, sortOrder: 4 },
    { name: 'Follow-up', code: 'followup', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: false, sortOrder: 5 },
    { name: 'Reasonable Suspicion/Cause', code: 'reasonable_suspicion', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: true, sortOrder: 6 },
    { name: 'Periodic Medical', code: 'periodic_medical', isDotAllowed: false, isNonDotAllowed: true, autoUrgent: false, sortOrder: 7 },
    { name: 'Promotion', code: 'promotion', isDotAllowed: false, isNonDotAllowed: true, autoUrgent: false, sortOrder: 8 },
    { name: 'Diversion', code: 'diversion', isDotAllowed: false, isNonDotAllowed: true, autoUrgent: false, sortOrder: 9 },
    { name: 'Transfer', code: 'transfer', isDotAllowed: false, isNonDotAllowed: true, autoUrgent: false, sortOrder: 10 },
    { name: 'Other', code: 'other', isDotAllowed: true, isNonDotAllowed: true, autoUrgent: false, sortOrder: 11 },
  ];

  const occHealthReasons = [
    { name: 'New Certification', code: 'new_certification', sortOrder: 1 },
    { name: 'Recertification', code: 'recertification', sortOrder: 2 },
    { name: 'Follow-up', code: 'followup', sortOrder: 3 },
    { name: 'Pre-employment', code: 'pre_employment', sortOrder: 4 },
    { name: 'Return to Duty', code: 'return_to_duty', sortOrder: 5 },
    { name: 'Site Access', code: 'site_access', sortOrder: 6 },
    { name: 'Surveillance', code: 'surveillance', sortOrder: 7 },
    { name: 'Other', code: 'other', sortOrder: 8 },
  ];

  await db.insert(reasonCatalog).values([
    ...drugTestingReasons.map((r) => ({
      tpaOrgId,
      category: 'drug_testing' as const,
      name: r.name,
      code: r.code,
      isDotAllowed: r.isDotAllowed,
      isNonDotAllowed: r.isNonDotAllowed,
      autoUrgent: r.autoUrgent,
      sortOrder: r.sortOrder,
    })),
    ...occHealthReasons.map((r) => ({
      tpaOrgId,
      category: 'occupational_health' as const,
      name: r.name,
      code: r.code,
      isDotAllowed: true,
      isNonDotAllowed: true,
      autoUrgent: false,
      sortOrder: r.sortOrder,
    })),
  ]);

  // =========================================================================
  // SERVICE CATALOG
  // =========================================================================

  // Drug Testing Services (rates in cents — industry standard TPA pricing)
  const drugTestingServices = [
    // DOT only
    { name: 'DOT Urine Collection for Drug Test', code: 'dot_urine', group: null, isDotOnly: true, isNonDotOnly: false, requiresPanel: false, sortOrder: 1, rate: 6500 },    // $65
    { name: 'DOT Breath Alcohol Test', code: 'dot_bat', group: null, isDotOnly: true, isNonDotOnly: false, requiresPanel: false, sortOrder: 2, rate: 5500 },                  // $55
    // Non-DOT only
    { name: 'eCup+ Urine Rapid Screen', code: 'ecup_urine', group: null, isDotOnly: false, isNonDotOnly: true, requiresPanel: true, sortOrder: 3, rate: 4500 },               // $45
    { name: 'Urine Collection for Drug Test', code: 'urine', group: null, isDotOnly: false, isNonDotOnly: true, requiresPanel: true, sortOrder: 4, rate: 5000 },               // $50
    { name: 'Oral Fluid Collection for Drug Test', code: 'oral_fluid', group: null, isDotOnly: false, isNonDotOnly: true, requiresPanel: false, sortOrder: 5, rate: 5500 },    // $55
    { name: 'Hair Collection for Drug Test', code: 'hair', group: null, isDotOnly: false, isNonDotOnly: true, requiresPanel: false, sortOrder: 6, rate: 8500 },                // $85
    { name: 'Breath Alcohol Test', code: 'bat', group: null, isDotOnly: false, isNonDotOnly: true, requiresPanel: false, sortOrder: 7, rate: 4500 },                            // $45
    // Dispatch/travel fees (both DOT and Non-DOT)
    { name: 'Onsite Collection / Travel Fee', code: 'onsite_travel', group: null, isDotOnly: false, isNonDotOnly: false, requiresPanel: false, sortOrder: 8, rate: 15000 },    // $150
    { name: 'After-Hours Dispatch Fee', code: 'after_hours', group: null, isDotOnly: false, isNonDotOnly: false, requiresPanel: false, sortOrder: 9, rate: 10000 },             // $100
    { name: 'Shy Bladder / Extended Wait (per hour)', code: 'shy_bladder', group: null, isDotOnly: false, isNonDotOnly: false, requiresPanel: false, sortOrder: 10, rate: 5000 }, // $50/hr
  ];

  // Occupational Health Services (rates in cents — industry standard TPA pricing)
  const occHealthServices = [
    // Audiogram
    { name: 'Audiogram', code: 'audiogram', group: 'Audiogram', sortOrder: 10, rate: 5000 },              // $50
    { name: 'Audiogram (Baseline)', code: 'audiogram_baseline', group: 'Audiogram', sortOrder: 11, rate: 6500 }, // $65
    // Blood/Lab
    { name: 'Blood Collection', code: 'blood_collection', group: 'Blood/Lab', sortOrder: 20, rate: 3500 },        // $35
    { name: 'Hep B Surface Antigen', code: 'hep_b_surface_antigen', group: 'Blood/Lab', sortOrder: 21, rate: 4500 }, // $45
    { name: 'Hepatitis A Antibody (Total)', code: 'hep_a_antibody', group: 'Blood/Lab', sortOrder: 22, rate: 4500 }, // $45
    { name: 'Hepatitis C Antibody Titer', code: 'hep_c_antibody', group: 'Blood/Lab', sortOrder: 23, rate: 4500 },   // $45
    { name: 'Hepatitis-B Titer HbsAb', code: 'hep_b_titer', group: 'Blood/Lab', sortOrder: 24, rate: 4500 },         // $45
    { name: 'Lipid Panel plus Glucose', code: 'lipid_panel_glucose', group: 'Blood/Lab', sortOrder: 25, rate: 5500 }, // $55
    { name: 'MMR Titer', code: 'mmr_titer', group: 'Blood/Lab', sortOrder: 26, rate: 5000 },                          // $50
    { name: 'Varicella Antibody IgG Titer', code: 'varicella_antibody', group: 'Blood/Lab', sortOrder: 27, rate: 4500 }, // $45
    { name: 'QuantiFERON TB-Gold', code: 'quantiferon_tb', group: 'Blood/Lab', sortOrder: 28, rate: 7500 },           // $75
    // Physical
    { name: 'DOT Physical', code: 'dot_physical', group: 'Physical', sortOrder: 30, rate: 15000 },          // $150
    { name: 'Non-DOT Physical', code: 'non_dot_physical', group: 'Physical', sortOrder: 31, rate: 12500 },  // $125
    { name: 'Physical Ability Test', code: 'physical_ability', group: 'Physical', sortOrder: 32, rate: 10000 }, // $100
    { name: 'Kraus Weber Lower Back Evaluation', code: 'kraus_weber', group: 'Physical', sortOrder: 33, rate: 7500 }, // $75
    // Lift Test
    { name: 'Lift Test', code: 'lift_test', group: 'Lift Test', sortOrder: 40, rate: 7500 },                // $75
    { name: 'Lift Test Level 2', code: 'lift_test_2', group: 'Lift Test', sortOrder: 41, rate: 10000 },     // $100
    // Respiratory
    { name: 'Physician Review of Questionnaire', code: 'physician_review_questionnaire', group: 'Respiratory', sortOrder: 50, rate: 5000 }, // $50
    { name: 'OSHA Respirator Questionnaire', code: 'osha_respirator_questionnaire', group: 'Respiratory', sortOrder: 51, rate: 3500 },      // $35
    { name: 'Respirator Certification', code: 'respirator_cert', group: 'Respiratory', sortOrder: 52, rate: 5000 },                          // $50
    { name: 'Pulmonary Function Test', code: 'pulmonary_function', group: 'Respiratory', sortOrder: 53, rate: 6500 },                        // $65
    { name: 'Respirator Fit Test, Qualitative', code: 'respirator_fit_qualitative', group: 'Respiratory', sortOrder: 54, rate: 5000 },       // $50
    { name: 'Respirator Fit Test, Quantitative', code: 'respirator_fit_quantitative', group: 'Respiratory', sortOrder: 55, rate: 7500 },     // $75
    // Vaccinations
    { name: 'Hepatitis A Vaccine #1', code: 'hep_a_vaccine_1', group: 'Vaccinations', sortOrder: 60, rate: 7500 },    // $75
    { name: 'Hepatitis A Vaccine #2', code: 'hep_a_vaccine_2', group: 'Vaccinations', sortOrder: 61, rate: 7500 },    // $75
    { name: 'Hep-B Vaccination #1', code: 'hep_b_vaccine_1', group: 'Vaccinations', sortOrder: 62, rate: 6500 },      // $65
    { name: 'Hep-B Vaccination #2', code: 'hep_b_vaccine_2', group: 'Vaccinations', sortOrder: 63, rate: 6500 },      // $65
    { name: 'Hep-B Vaccination #3', code: 'hep_b_vaccine_3', group: 'Vaccinations', sortOrder: 64, rate: 6500 },      // $65
    { name: 'Influenza Vaccine', code: 'influenza_vaccine', group: 'Vaccinations', sortOrder: 65, rate: 3500 },        // $35
    { name: 'MMR Vaccine #1', code: 'mmr_vaccine_1', group: 'Vaccinations', sortOrder: 66, rate: 9500 },              // $95
    { name: 'MMR Vaccine #2', code: 'mmr_vaccine_2', group: 'Vaccinations', sortOrder: 67, rate: 9500 },              // $95
    { name: 'TB/PPD Skin Test (1 step)', code: 'tb_ppd_skin_test', group: 'Vaccinations', sortOrder: 68, rate: 3000 }, // $30
    { name: 'Tdap Vaccine', code: 'tdap_vaccine', group: 'Vaccinations', sortOrder: 69, rate: 7500 },                  // $75
    { name: 'Varicella Vaccine #1', code: 'varicella_vaccine_1', group: 'Vaccinations', sortOrder: 70, rate: 12000 }, // $120
    { name: 'Varicella Vaccine #2', code: 'varicella_vaccine_2', group: 'Vaccinations', sortOrder: 71, rate: 12000 }, // $120
    // Vision
    { name: 'Vision Test, Ishihara', code: 'vision_ishihara', group: 'Vision', sortOrder: 72, rate: 2500 },   // $25
    { name: 'Vision Test, Jaeger', code: 'vision_jaeger', group: 'Vision', sortOrder: 73, rate: 2500 },       // $25
    { name: 'Vision Test, Snellen', code: 'vision_snellen', group: 'Vision', sortOrder: 74, rate: 2500 },     // $25
    { name: 'Vision Test, Titmus', code: 'vision_titmus', group: 'Vision', sortOrder: 75, rate: 3500 },       // $35
    // X-Ray
    { name: 'TB Chest X-Ray', code: 'tb_chest_xray', group: 'X-Ray', sortOrder: 80, rate: 10000 },           // $100
  ];

  await db.insert(serviceCatalog).values([
    ...drugTestingServices.map((s) => ({
      tpaOrgId,
      category: 'drug_testing' as const,
      group: s.group,
      name: s.name,
      code: s.code,
      isDotOnly: s.isDotOnly,
      isNonDotOnly: s.isNonDotOnly,
      requiresPanel: s.requiresPanel,
      rate: s.rate,
      sortOrder: s.sortOrder,
    })),
    ...occHealthServices.map((s) => ({
      tpaOrgId,
      category: 'occupational_health' as const,
      group: s.group,
      name: s.name,
      code: s.code,
      isDotOnly: false,
      isNonDotOnly: false,
      requiresPanel: false,
      rate: s.rate,
      sortOrder: s.sortOrder,
    })),
  ]);

  // =========================================================================
  // PANEL CODES
  // =========================================================================

  await db.insert(panelCodes).values([
    { tpaOrgId, code: '1200', name: '5 Panel Standard', sortOrder: 1 },
    { tpaOrgId, code: '1687', name: '4DSP/OPA/PHN', sortOrder: 2 },
    { tpaOrgId, code: '1790', name: '10DSP/OPA/NO THC/PHN', sortOrder: 3 },
    { tpaOrgId, code: '1975', name: '10DSP/OPA/CUSTOM LEVELS/PHN', sortOrder: 4 },
    { tpaOrgId, code: '2423', name: '10DSP/OPA/PHN', sortOrder: 5 },
    { tpaOrgId, code: '5316', name: '7DSP/EXP OPI2000/NO THC/CUST LVLS/MTD/OXY100/ECS/PHN', sortOrder: 6 },
    { tpaOrgId, code: '5318', name: '7DSP/EXP OPI2000/AMP500/COC150/MTD/OXY100/ECS/PHN', sortOrder: 7 },
    { tpaOrgId, code: '7342', name: '5DSP/EXP OPI100/NO THC/PHN', sortOrder: 8 },
  ]);
}
