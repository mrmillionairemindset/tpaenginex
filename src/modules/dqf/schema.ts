/**
 * DQF (Driver Qualification Files) module schema.
 *
 * Tables owned by this module: driver_applications, driver_qualifications,
 * dqf_checklists, dqf_checklist_items, annual_reviews,
 * employer_investigations, compliance_scores, public_ticket_forms.
 */

export {
  driverApplications,
  driverQualifications,
  dqfChecklists,
  dqfChecklistItems,
  annualReviews,
  employerInvestigations,
  complianceScores,
  publicTicketForms,
} from '@/db/schema';
