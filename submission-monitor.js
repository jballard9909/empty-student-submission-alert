// ============================================================
// EMPTY SUBMISSION CHECKER
// Checks daily for [UPLOAD] assignments submitted without
// attachments and emails the student a reminder.
//
// Built with: Google Apps Script, Google Classroom REST API,
//             Gmail API, OAuth 2.0, PropertiesService
//
// Setup: Run createDailyTrigger() once to schedule daily execution.
//        Grant required OAuth scopes when prompted.
// ============================================================


// --- CONFIGURATION ---
// Update these course names to match your Google Classroom exactly
const COURSE_NAMES = [
  'Spanish 8',
  'Spanish 7',
  'Spanish 6',
  'Spanish 5',
  'Music 8',
  'Music 7',
  'Music 6'
];

// Only assignments with this tag in the title are checked for attachments
const UPLOAD_TAG = '[UPLOAD]';

const EMAIL_SUBJECT = 'Missing Attachment: ';

const EMAIL_BODY_TEMPLATE =
  'Hi {firstName},\n\n' +
  'You submitted this assignment without attaching any work. ' +
  'Please un-submit the assignment, attach your work, and re-submit the assignment.\n\n' +
  'Assignment: {assignmentTitle}\n' +
  'Course: {courseName}\n\n' +
  'This is an automated message. Please do not reply to this email.';


// ============================================================
// MAIN FUNCTION — Daily trigger
// ============================================================
function checkEmptySubmissions() {
  Logger.log('=== Empty Submission Checker Started ===');

  // Load the list of submission IDs already notified.
  // Persisted across executions via PropertiesService to prevent
  // the same student from being emailed on subsequent days.
  const props = PropertiesService.getScriptProperties();
  const notifiedRaw = props.getProperty('notifiedSubmissions');
  const notified = new Set(notifiedRaw ? JSON.parse(notifiedRaw) : []);

  const newlyNotified = [];

  // Step 1: Get all active courses and filter by name
  const allCourses = Classroom.Courses.list({ courseStates: ['ACTIVE'] }).courses || [];
  const targetCourses = allCourses.filter(course => COURSE_NAMES.includes(course.name));

  if (targetCourses.length === 0) {
    Logger.log('WARNING: No matching courses found. Check that course names match exactly in Classroom.');
    return;
  }

  Logger.log(`Found ${targetCourses.length} matching course(s).`);

  // Step 2: Loop through each target course
  targetCourses.forEach(course => {
    Logger.log(`\nProcessing: ${course.name}`);

    // Step 3: Get all published assignments and filter for [UPLOAD] tag.
    // This prevents paper-based assignments from being incorrectly flagged.
    const courseWorkResponse = Classroom.Courses.CourseWork.list(
      course.id,
      { courseWorkStates: ['PUBLISHED'] }
    );
    const allCourseWork = courseWorkResponse.courseWork || [];
    const taggedAssignments = allCourseWork.filter(cw => cw.title.includes(UPLOAD_TAG));

    if (taggedAssignments.length === 0) {
      Logger.log(`  No [UPLOAD] assignments found in ${course.name}.`);
      return;
    }

    Logger.log(`  Found ${taggedAssignments.length} [UPLOAD] assignment(s).`);

    // Step 4: Loop through each tagged assignment
    taggedAssignments.forEach(assignment => {
      Logger.log(`  Checking: "${assignment.title}"`);

      // Step 5: Get only TURNED_IN submissions for this assignment
      const submissionsResponse = Classroom.Courses.CourseWork.StudentSubmissions.list(
        course.id,
        assignment.id,
        { states: ['TURNED_IN'] }
      );
      const submissions = submissionsResponse.studentSubmissions || [];

      if (submissions.length === 0) {
        Logger.log(`    No turned-in submissions.`);
        return;
      }

      // Step 6: Check each submission for empty attachments
      submissions.forEach(submission => {

        // Skip if this submission has already been notified
        if (notified.has(submission.id)) {
          Logger.log(`    Skipping ${submission.id} — already notified.`);
          return;
        }

        // Check whether any attachments exist
        const attachments =
          submission.assignmentSubmission &&
          submission.assignmentSubmission.attachments;
        const isEmpty = !attachments || attachments.length === 0;

        if (!isEmpty) {
          Logger.log(`    Submission ${submission.id} has attachments — OK.`);
          return;
        }

        // Step 7: No attachments found — get student profile and send email
        try {
          const profile = Classroom.UserProfiles.get(submission.userId);
          const email = profile.emailAddress;
          const firstName = (profile.name && profile.name.givenName) || 'Student';

          // Step 8: Look up guardian emails to CC on the notification.
          // Guardian access depends on domain-level Google Workspace settings —
          // wrapped in its own try/catch so a failure here never breaks the
          // core email workflow.
          let guardianEmails = [];
          try {
            const guardiansResponse = Classroom.UserProfiles.Guardians.list(submission.userId);
            const guardians = guardiansResponse.guardians || [];
            guardianEmails = guardians
              .map(g => g.guardianProfile && g.guardianProfile.emailAddress)
              .filter(Boolean);
            if (guardianEmails.length > 0) {
              Logger.log(`    Found ${guardianEmails.length} guardian(s) to CC.`);
            } else {
              Logger.log(`    No guardians found — sending to student only.`);
            }
          } catch (guardianError) {
            Logger.log(`    Guardian lookup skipped: ${guardianError.message}`);
          }

          const body = EMAIL_BODY_TEMPLATE
            .replace('{firstName}', firstName)
            .replace('{assignmentTitle}', assignment.title)
            .replace('{courseName}', course.name);

          // Only add CC field if guardians were found
          const emailOptions = {};
          if (guardianEmails.length > 0) {
            emailOptions.cc = guardianEmails.join(',');
          }

          GmailApp.sendEmail(
            email,
            EMAIL_SUBJECT + assignment.title,
            body,
            emailOptions
          );

          newlyNotified.push(submission.id);
          const ccNote = guardianEmails.length > 0 ? ` (CC: ${guardianEmails.join(', ')})` : '';
          Logger.log(`    ✓ Email sent to ${email} (${firstName})${ccNote} for "${assignment.title}"`);

        } catch (e) {
          Logger.log(`    ERROR on submission ${submission.id}: ${e.message}`);
        }
      });
    });
  });

  // Save the updated list of notified submission IDs for next execution
  const allNotified = [...notified, ...newlyNotified];
  props.setProperty('notifiedSubmissions', JSON.stringify(allNotified));

  Logger.log(`\n=== Done. ${newlyNotified.length} new notification(s) sent. ===`);
}


// ============================================================
// SETUP FUNCTION — Run once to create the daily trigger
// ============================================================
function createDailyTrigger() {
  // Remove any existing triggers first to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkEmptySubmissions') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create a new daily trigger at 4:00 PM
  ScriptApp.newTrigger('checkEmptySubmissions')
    .timeBased()
    .everyDays(1)
    .atHour(16)
    .create();

  Logger.log('Daily trigger created — will run at 4 PM each day.');
}


// ============================================================
// UTILITY — Clears the deduplication store
// Use this for testing or at the start of a new semester
// ============================================================
function clearNotifiedSubmissions() {
  PropertiesService.getScriptProperties().deleteProperty('notifiedSubmissions');
  Logger.log('Notified submissions list cleared.');
}
