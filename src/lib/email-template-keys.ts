export const AVAILABLE_TEMPLATE_KEYS = [
  { key: 'collector_assigned', label: 'Collector Assigned', vars: ['personName', 'orderNumber', 'collectorName'] },
  { key: 'order_completion', label: 'Order Completion', vars: ['personName', 'orderNumber'] },
  { key: 'event_completion', label: 'Event Completion', vars: ['clientName', 'eventNumber', 'totalDone', 'totalPending'] },
  { key: 'pending_results_reminder', label: 'Pending Results Reminder', vars: ['eventNumber', 'resultsCount'] },
  { key: 'kit_mailing_reminder', label: 'Kit Mailing Reminder', vars: ['clientName', 'eventNumber'] },
  { key: 'annual_review_reminder', label: 'Annual Review Reminder', vars: ['personName', 'reviewDate'] },
  { key: 'license_expiry_alert', label: 'License Expiry Alert', vars: ['personName', 'qualificationType', 'expiresAt'] },
  { key: 'mec_expiry_reminder', label: 'MEC Expiry Reminder', vars: ['driverName', 'expiresOn', 'daysUntil', 'recipientName'] },
  { key: 'ticket_form_confirmation', label: 'Application Received', vars: ['applicantName'] },
  {
    key: 'random_selection_notification',
    label: 'Random Selection Notification',
    vars: ['recipientName', 'selectionType', 'testingType', 'scheduledByDate', 'reportingInstructions'],
  },
];
