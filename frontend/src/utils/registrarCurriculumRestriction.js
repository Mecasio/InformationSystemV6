import axios from "axios";
import API_BASE_URL from "../apiConfig";

export const setRegistrarCurriculumId = (value) => {
  if (typeof window === "undefined") return "";

  const curriculumId = value === null || value === undefined ? "" : String(value);
  localStorage.setItem("curriculum_id", curriculumId);
  localStorage.setItem("registrar_curriculum_id", curriculumId);
  return curriculumId;
};

export const refreshRegistrarCurriculumId = async (employeeId) => {
  if (typeof window === "undefined") return "";
  if (localStorage.getItem("role") !== "registrar") return "";

  const currentEmployeeId = employeeId || localStorage.getItem("employee_id");
  if (!currentEmployeeId) return "";

  const response = await axios.get(`${API_BASE_URL}/api/employee/${currentEmployeeId}`);
  const curriculumId = setRegistrarCurriculumId(response.data?.curriculum_id || "");

  window.dispatchEvent(
    new CustomEvent("registrar-curriculum-updated", {
      detail: { curriculum_id: curriculumId },
    })
  );

  return curriculumId;
};

export const getRegistrarCurriculumId = () => {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("curriculum_id") ||
    localStorage.getItem("registrar_curriculum_id") ||
    ""
  );
};

export const hasRegistrarCurriculumRestriction = () =>
  Boolean(getRegistrarCurriculumId());

export const isRegistrarCurriculumMatch = (value) => {
  const curriculumId = getRegistrarCurriculumId();
  if (!curriculumId) return true;
  if (value === null || value === undefined || value === "") return false;

  return String(value) === String(curriculumId);
};

export const restrictToRegistrarCurriculum = (items = [], getValue) => {
  const curriculumId = getRegistrarCurriculumId();
  if (!curriculumId) return items;

  return items.filter((item) => {
    const value = getValue
      ? getValue(item)
      : item?.curriculum_id ?? item?.program ?? item?.active_curriculum;

    return String(value ?? "") === String(curriculumId);
  });
};
