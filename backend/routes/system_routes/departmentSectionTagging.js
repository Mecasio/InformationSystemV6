const express = require("express");
const { db3 } = require("../database/database");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");
const router = express.Router();

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActor = (req) => ({
  actorId:
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    "unknown",
  actorRole:
    req.body?.audit_actor_role ||
    req.headers["x-audit-actor-role"] ||
    "registrar",
});

const insertDepartmentSectionTaggingAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    message,
    severity: "INFO",
  });
};

const getDepartmentSectionLabel = async (departmentSectionId) => {
  const [[section]] = await db3.query(
    `
    SELECT
      pt.program_code,
      st.description AS section_description
    FROM dprtmnt_section_table dst
    INNER JOIN curriculum_table ct ON dst.curriculum_id = ct.curriculum_id
    INNER JOIN program_table pt ON ct.program_id = pt.program_id
    INNER JOIN section_table st ON dst.section_id = st.id
    WHERE dst.id = ?
    LIMIT 1
    `,
    [departmentSectionId]
  );

  if (!section) return `department section ${departmentSectionId}`;

  const programCode = String(section.program_code || "").trim();
  const sectionDescription = String(section.section_description || "").trim();

  if (programCode && sectionDescription) return `${programCode}-${sectionDescription}`;
  return programCode || sectionDescription || `department section ${departmentSectionId}`;
};

const getYearLevelLabel = async (yearLevelId) => {
  if (!yearLevelId) return "";

  const [[yearLevel]] = await db3.query(
    "SELECT year_level_description FROM year_level_table WHERE year_level_id = ? LIMIT 1",
    [yearLevelId]
  );

  return String(yearLevel?.year_level_description || "").trim().toLowerCase();
};

const formatStudentCountLabel = (count, yearLevelLabel) => {
  const safeCount = Number(count) || 0;
  const yearPhrase = yearLevelLabel ? `${yearLevelLabel} ` : "";
  return `${safeCount} ${yearPhrase}student`;
};

router.get('/get_student_per_curriculum', async (req, res) => {
  const { curriculum_id, active_school_year_id, year_level_id } = req.query;
  console.log("Received params - Curriculum ID:", curriculum_id, "Active School Year ID:", active_school_year_id, "Year Level ID:", year_level_id);
    try {
        const params = [curriculum_id, active_school_year_id];
        const yearLevelClause = year_level_id ? "AND sst.year_level_id = ?" : "";
        if (year_level_id) params.push(year_level_id);

        const [rows] = await db3.query(
            `
            SELECT 
            es.student_number, p.first_name, p.last_name,
            pgt.program_code, pgt.program_id, pgt.program_description,
            s.student_number,
            sst.year_level_id,
            ylt.year_level_description
            FROM enrolled_subject es
            JOIN student_numbering_table s ON es.student_number = s.student_number
            JOIN person_table p ON s.person_id = p.person_id
            JOIN curriculum_table ct ON es.curriculum_id = ct.curriculum_id
            JOIN program_table pgt ON ct.program_id = pgt.program_id
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            LEFT JOIN year_level_table ylt ON sst.year_level_id = ylt.year_level_id
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? and (es.department_section_id IS NULL or es.department_section_id = 0)
            ${yearLevelClause}
            GROUP BY es.student_number
            `,
            params
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "No students found for the given curriculum and school year" });
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch student data" });
    }
});

router.get('/get_student_already_tagged', async (req, res) => {
  const { curriculum_id, active_school_year_id, year_level_id } = req.query;
  console.log("Received params - Curriculum ID:", curriculum_id, "Active School Year ID:", active_school_year_id, "Year Level ID:", year_level_id);
    try {
        const params = [curriculum_id, active_school_year_id];
        const yearLevelClause = year_level_id ? "AND sst.year_level_id = ?" : "";
        if (year_level_id) params.push(year_level_id);

        const [rows] = await db3.query(
            `SELECT
            es.student_number, p.first_name, p.last_name,
            pgt.program_code, pgt.program_id, pgt.program_description,
            s.student_number,
            sst.year_level_id,
            ylt.year_level_description
            FROM enrolled_subject es
            JOIN student_numbering_table s ON es.student_number = s.student_number
            JOIN person_table p ON s.person_id = p.person_id
            JOIN curriculum_table ct ON es.curriculum_id = ct.curriculum_id
            JOIN program_table pgt ON ct.program_id = pgt.program_id
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            LEFT JOIN year_level_table ylt ON sst.year_level_id = ylt.year_level_id
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND (es.department_section_id IS NOT NULL AND es.department_section_id != 0)
            ${yearLevelClause}
            GROUP BY es.student_number
            `,
            params
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "No students found for the given curriculum and school year" });
        }
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch student data" });
    }
});

//for bulk enroll
router.put('/enrolled_student_in_section', async (req, res) => {
    const { curriculum_id, active_school_year_id, department_section_id, year_level_id, student_numbers } = req.body;

    if (!curriculum_id || !active_school_year_id || !department_section_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const filterParams = [curriculum_id, active_school_year_id];
        const yearLevelClause = year_level_id ? "AND sst.year_level_id = ?" : "";
        if (year_level_id) filterParams.push(year_level_id);
        const selectedStudentNumbers = Array.isArray(student_numbers)
            ? student_numbers.map((number) => String(number).trim()).filter(Boolean)
            : [];
        const selectedStudentClause = selectedStudentNumbers.length > 0
            ? `AND es.student_number IN (${selectedStudentNumbers.map(() => "?").join(", ")})`
            : "";
        filterParams.push(...selectedStudentNumbers);

        const [[eligibleStudentCount]] = await db3.query(
            `
            SELECT COUNT(DISTINCT es.student_number) AS student_count
            FROM enrolled_subject es
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND (es.department_section_id IS NULL OR es.department_section_id = 0)
            ${yearLevelClause}
            ${selectedStudentClause}
            `,
            filterParams
        );

        const params = [department_section_id, ...filterParams];

        const [result] = await db3.query(
            `
            UPDATE enrolled_subject es
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            SET es.department_section_id = ?
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND (es.department_section_id IS NULL OR es.department_section_id = 0)
            ${yearLevelClause}
            ${selectedStudentClause}
            `,
            params
        );

        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        const sectionLabel = await getDepartmentSectionLabel(department_section_id);
        const yearLevelLabel = await getYearLevelLabel(year_level_id);
        const studentCountLabel = formatStudentCountLabel(
            eligibleStudentCount?.student_count,
            yearLevelLabel
        );
        await insertDepartmentSectionTaggingAuditLog({
            req,
            action: selectedStudentNumbers.length > 0
                ? "DEPARTMENT_SECTION_STUDENT_ENROLL_SELECTED"
                : "DEPARTMENT_SECTION_STUDENT_ENROLL_ALL",
            message: `${roleLabel} (${actorId}) enrolled ${studentCountLabel} in ${sectionLabel}.`,
        });

        res.json({
            message: `The students was successfully enrolled in the section`,
            affectedRows: result.affectedRows,
            affectedStudents: eligibleStudentCount?.student_count || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to enroll students in section" });
    }
});

router.put('/enrolled_student_in_section/:student_number', async (req, res) => {
  const { student_number } = req.params;
  const { curriculum_id, department_section_id, active_school_year_id } = req.body;

  console.log("Received params - Student Number:", student_number, "Curriculum ID:", curriculum_id, "Department Section ID:", department_section_id, "Active School Year ID:", active_school_year_id);
    if (!curriculum_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = ?
            WHERE student_number = ? AND curriculum_id = ? AND active_school_year_id = ?
            `,
            [department_section_id, student_number, curriculum_id, active_school_year_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found or already enrolled in a section" });
        }
        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        const sectionLabel = await getDepartmentSectionLabel(department_section_id);
        const [[studentYearLevel]] = await db3.query(
            `
            SELECT ylt.year_level_description
            FROM student_status_table sst
            LEFT JOIN year_level_table ylt ON sst.year_level_id = ylt.year_level_id
            WHERE sst.student_number = ?
              AND sst.active_curriculum = ?
              AND sst.active_school_year_id = ?
            LIMIT 1
            `,
            [student_number, curriculum_id, active_school_year_id]
        );
        const studentCountLabel = formatStudentCountLabel(
            1,
            String(studentYearLevel?.year_level_description || "").trim().toLowerCase()
        );
        await insertDepartmentSectionTaggingAuditLog({
            req,
            action: "DEPARTMENT_SECTION_STUDENT_ENROLL",
            message: `${roleLabel} (${actorId}) enrolled ${studentCountLabel} ${student_number} in ${sectionLabel}.`,
        });
        res.json({ message: "Student enrolled in section successfully" });
    } catch (err) {
        console.error(err);        
        res.status(500).json({ error: "Failed to enroll student in section" });
    }   
});
//BULK UNENROLL STUDENTS FROM SECTION
router.put('/unenrolled_student_in_section', async (req, res) => {
  const { curriculum_id, active_school_year_id, department_section_id, year_level_id } = req.body;
    if (!curriculum_id || !active_school_year_id || !department_section_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const params = [curriculum_id, active_school_year_id, department_section_id];
        const yearLevelClause = year_level_id ? "AND sst.year_level_id = ?" : "";
        if (year_level_id) params.push(year_level_id);

        const [[eligibleStudentCount]] = await db3.query(
            `
            SELECT COUNT(DISTINCT es.student_number) AS student_count
            FROM enrolled_subject es
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND es.department_section_id = ?
            ${yearLevelClause}
            `,
            params
        );

        const [result] = await db3.query(
            `
            UPDATE enrolled_subject es
            LEFT JOIN student_status_table sst
              ON sst.student_number = es.student_number
             AND sst.active_curriculum = es.curriculum_id
             AND sst.active_school_year_id = es.active_school_year_id
            SET es.department_section_id = NULL
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND es.department_section_id = ?
            ${yearLevelClause}
            `,
            params
        );
        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        const sectionLabel = await getDepartmentSectionLabel(department_section_id);
        const yearLevelLabel = await getYearLevelLabel(year_level_id);
        const studentCountLabel = formatStudentCountLabel(
            eligibleStudentCount?.student_count,
            yearLevelLabel
        );
        await insertDepartmentSectionTaggingAuditLog({
            req,
            action: "DEPARTMENT_SECTION_STUDENT_UNENROLL_ALL",
            message: `${roleLabel} (${actorId}) unenrolled ${studentCountLabel} from ${sectionLabel}.`,
        });
        res.json({
            message: "Students unenrolled from section successfully",
            affectedRows: result.affectedRows,
            affectedStudents: eligibleStudentCount?.student_count || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unenroll students from section" });
    }
});

//UNENROLL STUDENT FROM SECTION
router.put('/unenrolled_student_in_section/:student_number', async (req, res) => {
  const { student_number } = req.params;
  const { curriculum_id, department_section_id, active_school_year_id } = req.body;
    if (!curriculum_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = NULL
            WHERE student_number = ? AND curriculum_id = ? AND active_school_year_id = ? AND department_section_id = ?
            `,
            [student_number, curriculum_id, active_school_year_id, department_section_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found or not enrolled in the specified section" });
        }
        const { actorId, actorRole } = getAuditActor(req);
        const roleLabel = formatAuditActorRole(actorRole);
        const sectionLabel = await getDepartmentSectionLabel(department_section_id);
        const [[studentYearLevel]] = await db3.query(
            `
            SELECT ylt.year_level_description
            FROM student_status_table sst
            LEFT JOIN year_level_table ylt ON sst.year_level_id = ylt.year_level_id
            WHERE sst.student_number = ?
              AND sst.active_curriculum = ?
              AND sst.active_school_year_id = ?
            LIMIT 1
            `,
            [student_number, curriculum_id, active_school_year_id]
        );
        const studentCountLabel = formatStudentCountLabel(
            1,
            String(studentYearLevel?.year_level_description || "").trim().toLowerCase()
        );
        await insertDepartmentSectionTaggingAuditLog({
            req,
            action: "DEPARTMENT_SECTION_STUDENT_UNENROLL",
            message: `${roleLabel} (${actorId}) unenrolled ${studentCountLabel} ${student_number} from ${sectionLabel}.`,
        });
        res.json({ message: "Student unenrolled from section successfully" });
    } catch (err) {
        console.error(err);        
        res.status(500).json({ error: "Failed to unenroll student from section" });
    }   
});

module.exports = router;
