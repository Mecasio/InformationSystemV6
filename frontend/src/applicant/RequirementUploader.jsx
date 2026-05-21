import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  Container,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import axios from "axios";
import ErrorIcon from "@mui/icons-material/Error";
import API_BASE_URL from "../apiConfig";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SendIcon from "@mui/icons-material/Send";
import { Chip } from "@mui/material";

const RequirementUploader = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Info
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);

    // ✅ Branches (JSON stored in DB)
    if (settings.branches) {
      setBranches(
        typeof settings.branches === "string"
          ? JSON.parse(settings.branches)
          : settings.branches
      );
    }

  }, [settings]);

  const getBranchLabel = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    return branch?.branch || "—";
  };


  const [requirements, setRequirements] = useState([]); // ✅ dynamic requirements

  const [uploads, setUploads] = useState([]);
  const [userID, setUserID] = useState("");
  const [selectedFiles, setSelectedFiles] = useState({});
  const [allRequirementsCompleted, setAllRequirementsCompleted] = useState(
    localStorage.getItem("requirementsCompleted") === "1",
  );
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    const id = localStorage.getItem("person_id");
    if (id) {
      setUserID(id);
      fetchUploads(id);
    }

    // ✅ Fetch all requirements dynamically from backend
    axios
      .get(`${API_BASE_URL}/requirements/${id}`)
      .then((res) => setRequirements(res.data))
      .catch((err) => console.error("Error loading requirements:", err));
  }, []);

  const [openModal, setOpenModal] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);

  const fetchUploads = async (personId) => {
    try {
      // ✅ Fetch user's uploaded files
      const res = await axios.get(`${API_BASE_URL}/uploads/${personId}`);
      const uploadsData = res.data;
      console.log(uploadsData);
      setUploads(uploadsData);

      // ✅ Map uploaded files to their requirement IDs
      const rebuiltSelectedFiles = {};
      uploadsData.forEach((upload) => {
        rebuiltSelectedFiles[upload.requirements_id] = upload.original_name;
      });
      setSelectedFiles(rebuiltSelectedFiles);

      // ✅ Get all verifiable requirements from DB
      // ✅ Get ONLY Regular + Verifiable requirements
      const reqRes = await axios.get(
        `${API_BASE_URL}/requirements/${personId}`,
      );

      const verifiableRequirements = reqRes.data.filter(
        (r) => r.is_verifiable === 1 && r.category === "Main",
      );

      // ✅ Compare uploaded vs required
      const uploadedIds = new Set(uploadsData.map((u) => u.requirements_id));

      const allRequiredUploaded =
        verifiableRequirements.length > 0 &&
        verifiableRequirements.every((r) => uploadedIds.has(r.id));

      if (
        uploadsData.length > 0 &&
        allRequiredUploaded &&
        !allRequirementsCompleted
      ) {
        setOpenConfirmModal(true);
      }

      // ✅ Update completion state
      setAllRequirementsCompleted(allRequiredUploaded);
      localStorage.setItem(
        "requirementsCompleted",
        allRequiredUploaded ? "1" : "0",
      );
    } catch (err) {
      console.error("❌ Fetch uploads failed:", err);
    }
  };




  const handleUpload = async (key, file) => {
    if (!file) return;

    const personId = userID || localStorage.getItem("person_id");

    if (!personId) {
      setSnack({
        open: true,
        severity: "error",
        message: "Unable to upload: applicant ID was not found.",
      });
      return;
    }

    // ✅ 4MB check
    const maxSize = 4 * 1024 * 1024;

    if (file.size > maxSize) {
      setSnack({
        open: true,
        severity: "error",
        message: "File must not exceed 4MB",
      });
      return; // ❌ STOP upload
    }

    setSelectedFiles((prev) => ({ ...prev, [key]: file.name }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("requirements_id", key);
    formData.append("person_id", personId);

    try {
      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ REFRESH STATE IMMEDIATELY
      await fetchUploads(personId);

      setSnack({
        open: true,
        severity: "success",
        message: "File uploaded successfully.",
      });


    } catch (err) {
      console.error("Upload error:", err);

      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      setSnack({
        open: true,
        severity: "error",
        message: err.response?.data?.error || "Upload failed",
      });
    }
  };

  const handleDelete = async (uploadId) => {
    try {
      await axios.delete(`${API_BASE_URL}/uploads/${uploadId}`, {
        headers: { "x-person-id": userID },
      });

      setSnack({
        open: true,
        severity: "success",
        message: "File deleted successfully",
      });

      // slight delay so snackbar shows before refresh
      setTimeout(() => {
        fetchUploads(userID);
      }, 300);

    } catch (err) {
      console.error("Delete error:", err);

      setSnack({
        open: true,
        severity: "error",
        message: "Failed to delete file",
      });
    }
  };

  const isFormValid = () => {
    // ✅ Get MAIN required requirements
    const requiredMain = requirements.filter(
      (r) => r.category === "Main" && Number(r.is_required) === 1,
    );

    // ✅ Get uploaded requirement IDs
    const uploadedIds = new Set(uploads.map((u) => Number(u.requirements_id)));

    // ✅ Find missing ones
    const missing = requiredMain.filter(
      (req) => !uploadedIds.has(Number(req.id)),
    );

    if (missing.length > 0) {
      const names = missing.map((m) => m.description).join(", ");

      setSnack({
        open: true,
        severity: "warning",
        message: `Please upload all required MAIN requirements: ${names}`,
      });

      return false;
    }

    return true;
  };

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  const renderRow = (doc) => {
    const uploaded = uploads.find(
      (u) => Number(u.requirements_id) === Number(doc.id),
    );

    return (
      <TableRow key={doc.id}>
        <TableCell
          sx={{
            fontWeight: "bold",
            width: "25%",
            border: `1px solid ${borderColor}`,
          }}
        >
          {doc.label}
          {doc.is_optional === 1 && (
            <span style={{ marginLeft: 2 }}>(Optional)</span>
          )}

          {doc.is_required === 1 && (
            <span style={{ color: "red", marginLeft: 5 }}>*</span>
          )}
        </TableCell>
        <TableCell
          sx={{
            width: "25%",
            border: `1px solid ${borderColor}`,
            textAlign: "center",
            verticalAlign: "middle", // ✅ center vertically in cell
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center", // ✅ center horizontally
              gap: 1,
              width: "100%",
            }}
          >
            <Box sx={{ width: "220px", flexShrink: 0, textAlign: "center" }}>
              {selectedFiles[doc.id] ? (
                <Box
                  sx={{
                    backgroundColor: "#e0e0e0",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={selectedFiles[doc.id]}
                >
                  {selectedFiles[doc.id]}
                </Box>
              ) : (
                <Box sx={{ height: "40px" }} />
              )}
            </Box>

            <Box sx={{ flexShrink: 0 }}>
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                sx={{
                  backgroundColor: "#F0C03F",
                  color: "white",
                  fontWeight: "bold",
                  height: "40px",
                  textTransform: "none",
                  minWidth: "140px",
                }}
              >
                Browse File
                <input
                  key={selectedFiles[doc.id] || `empty-${doc.id}`}
                  hidden
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleUpload(doc.id, e.target.files[0])}
                />
              </Button>
            </Box>
          </Box>
        </TableCell>

        <TableCell sx={{ width: "25%", border: `1px solid ${borderColor}` }}>
          {typeof uploaded?.remarks === "string" &&
            uploaded.remarks.trim() !== "" && (
              <Typography
                sx={{
                  fontStyle: "normal",
                  color: "inherit",
                }}
              >
                {uploaded.remarks}
              </Typography>
            )}

          {uploaded?.status == 1 || uploaded?.status == 2 ? (
            <Typography
              sx={{
                mt: 0.5,
                fontSize: "14px",
                color: uploaded?.status == 1 ? "green" : "red",
                fontWeight: "bold",
              }}
            >
              {uploaded?.status == 1 ? "Verified" : "Rejected"}
            </Typography>
          ) : null}
        </TableCell>

        <TableCell sx={{ width: "10%", border: `1px solid ${borderColor}` }}>
          {uploaded && (
            <Button
              variant="contained"
              color="primary"
              href={`${API_BASE_URL}/ApplicantOnlineDocuments/${uploaded.file_path}`}
              target="_blank"
              startIcon={<VisibilityIcon />}
              sx={{
                color: "white",
                fontWeight: "bold",
                height: "40px",
                textTransform: "none",
                minWidth: "140px",
              }}
            >
              Preview
            </Button>
          )}
        </TableCell>

        <TableCell sx={{ width: "10%", border: `1px solid ${borderColor}` }}>
          {uploaded && (
            <Button
              onClick={() => handleDelete(uploaded.upload_id)}
              startIcon={<DeleteIcon />}
              sx={{
                backgroundColor: "#9E0000",
                color: "white",
                fontWeight: "bold",
                height: "40px",
                textTransform: "none",
                minWidth: "140px",
              }}
            >
              Delete
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        paddingRight: 1,
        backgroundColor: "transparent",
        mt: 1,
        padding: 2,
      }}
    >
      {/* ✅ Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={handleClose}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

      {/* ===== APPLICATION SUBMITTED SUCCESSFULLY DIALOG ===== */}
      {/* ===== APPLICATION SUBMITTED SUCCESSFULLY DIALOG ===== */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            overflow: "hidden",
            minWidth: 420,
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            position: "relative",
          },
        }}
      >

        <DialogTitle
          sx={{
            bgcolor: settings?.header_color || "#1976d2",
            color: "white",
            display: "flex",
            alignItems: "center",
            fontWeight: "bold",
            px: 3,
            py: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              <Typography fontSize={20}>🎉</Typography>
            </Box>
            <Box>
              <Typography fontWeight="bold" fontSize={16} color="white" lineHeight={1.2}>
                Application Submitted Successfully!
              </Typography>
              <Typography fontSize={12} color="rgba(255,255,255,0.8)" lineHeight={1.2}>
                Your application has been received
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          {/* Trophy ring */}
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5, mt: 1 }}>
            <Box
              sx={{
                width: 76, height: 76,
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.9)",
                border: `3px solid ${settings?.header_color || "#1976d2"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 34,
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute", inset: -7,
                  borderRadius: "50%",
                  border: `2px dashed ${settings?.header_color || "#1976d2"}`,
                  opacity: 0.4,
                  animation: "spin 8s linear infinite",
                },
                "@keyframes spin": { to: { transform: "rotate(360deg)" } },
              }}
            >
              🎓
            </Box>
          </Box>

          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", mb: 1 }}>
              Congratulations, Applicant!
            </Typography>
            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.65, mb: 1 }}>
              Your application to{" "}
              <strong style={{ color: settings?.header_color || "#1976d2" }}>
                {companyName}
              </strong>{" "}
              has been successfully received.
            </Typography>
            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.65 }}>
              The{" "}
              <strong style={{ color: settings?.header_color || "#1976d2" }}>
                Admission Office
              </strong>{" "}
              will contact you regarding the evaluation of your submitted documents.
            </Typography>
          </Box>

          <Box sx={{ borderTop: "1px solid #e0e0e0", my: 2 }} />

          {/* Info cards */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 1 }}>
            {[
              {
                icon: <EmailOutlinedIcon sx={{ fontSize: 18, color: settings?.header_color || "#1976d2", flexShrink: 0 }} />,
                label: "Check your Gmail for email updates from the Admission Office.",
              },
              {
                icon: <DashboardOutlinedIcon sx={{ fontSize: 18, color: settings?.header_color || "#1976d2", flexShrink: 0 }} />,
                label: "Monitor your Applicant Dashboard for real-time status updates.",
              },
            ].map((item, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  backgroundColor: "#f0f7ff",
                  borderLeft: `3px solid ${settings?.header_color || "#1976d2"}`,
                  borderRadius: "0 9px 9px 0",
                  p: 1.5,
                  display: "flex", gap: 1, alignItems: "flex-start",
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: 12.5, color: "#333", lineHeight: 1.5 }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
          <Button
            fullWidth
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              setOpenModal(false);
              window.location.href = "/applicant_dashboard";
            }}
            sx={{
              height: 44,
              borderRadius: "10px",
              backgroundColor: settings?.header_color || "#1976d2",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: settings?.header_color || "#1976d2",
                opacity: 0.9,
                boxShadow: "none",
              },
            }}
          >
            Go to Applicant Dashboard
          </Button>
        </DialogActions>
      </Dialog>


      {/* ===== REVIEW UPLOADED REQUIREMENTS DIALOG ===== */}
      <Dialog
        open={openConfirmModal}
        onClose={() => setOpenConfirmModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: settings?.header_color || "#1976d2",
            color: "white",
            display: "flex",
            alignItems: "center",
            fontWeight: "bold",
            px: 3,
            py: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              <Typography fontSize={20}>📄</Typography>
            </Box>
            <Box>
              <Typography fontWeight="bold" fontSize={16} color="white" lineHeight={1.2}>
                Review Your Uploaded Requirements
              </Typography>
              <Typography fontSize={12} color="rgba(255,255,255,0.8)" lineHeight={1.2}>
                Check all documents carefully before submitting
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, px: 3, pb: 1 }}>
          {/* Warning notice */}
          <Box
            sx={{
              border: "1px solid #f5a623",
              borderRadius: "8px",
              p: 1.5,
              mb: 2.5,
              mt: 2,
              display: "flex",
              gap: 1,
              alignItems: "flex-start",
              backgroundColor: "#fffbf2",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <Typography fontSize={12.5} color="#5d4037" lineHeight={1.5}>
              <strong>Notice:</strong> Ensure all uploaded documents are{" "}
              <strong>correct, clear, and valid</strong>. Incomplete or unclear
              files may delay the processing of your admission application.
            </Typography>
          </Box>

          {/* Document list */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
            {requirements
              .filter((r) => r.category === "Main")
              .map((doc) => {
                const uploaded = uploads.find(
                  (u) => Number(u.requirements_id) === Number(doc.id)
                );
                return (
                  <Box
                    key={doc.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      backgroundColor: uploaded ? "#f0fff4" : "#fafafa",
                      border: uploaded ? "1px solid #4caf50" : "1px solid #e0e0e0",
                      borderRadius: "10px",
                      p: "10px 14px",
                      transition: "border-color 0.2s",
                    }}
                  >
                    {/* Status circle */}
                    <Box
                      sx={{
                        width: 36, height: 36,
                        borderRadius: "50%",
                        backgroundColor: uploaded ? "#4caf50" : "#e0e0e0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Typography fontSize={16} color="white" fontWeight="bold">
                        {uploaded ? "✓" : "–"}
                      </Typography>
                    </Box>

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {doc.description}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: uploaded ? "#2e7d32" : "#999", mt: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {uploaded?.original_name || "No file uploaded"}
                      </Typography>
                    </Box>

                    {/* Action */}
                    {uploaded ? (
                      <Button
                        variant="contained"
                        color="primary"
                        href={`${API_BASE_URL}/ApplicantOnlineDocuments/${uploaded.file_path}`}
                        target="_blank"
                        startIcon={<VisibilityIcon />}
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          height: "40px",
                          textTransform: "none",
                          minWidth: "140px",
                        }}
                      >
                        Preview
                      </Button>
                    ) : (
                      <Chip
                        label="Missing"
                        size="small"
                        sx={{
                          height: 24, fontSize: 11, fontWeight: 700,
                          backgroundColor: "#FEE2E2", color: "#B91C1C",
                          borderRadius: "6px", flexShrink: 0,
                          "& .MuiChip-label": { px: 1.2 },
                        }}
                      />
                    )}
                  </Box>
                );
              })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, display: "flex", justifyContent: "space-between" }}>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setOpenConfirmModal(false)}

          >
            Cancel
          </Button>

          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={() => {
              if (!isFormValid()) return;
              setOpenConfirmModal(false);
              localStorage.setItem("requirementsCompleted", "1");
              setOpenModal(true);
            }}
            sx={{
              minWidth: 200,
              height: 42,

              backgroundColor: settings?.header_color || "#1976d2",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: settings?.header_color || "#1976d2",
                opacity: 0.9,
                boxShadow: "none",
              },
            }}
          >
            Submit Requirements
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",

          mb: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
          }}
        >
          APPLICANT'S DOCUMENTS
        </Typography>
      </Box>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />

      <br />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          mt: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 2,
            width: "100%",
            p: 2,
            borderRadius: "10px",
            backgroundColor: "#fffaf5",
            border: "1px solid #6D2323",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#800000",
              borderRadius: "8px",
              width: 60,
              height: 60,
              flexShrink: 0,
            }}
          >
            <ErrorIcon sx={{ color: "white", fontSize: 40 }} />
          </Box>

          {/* Text */}
          <Typography
            sx={{
              fontSize: "18px",
              fontFamily: "Poppins, sans-serif",
              color: "#3e3e3e",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#600000" }}>Notice:</strong> Applicants are
            required to submit all{" "}
            <strong>Main Requirements (required) documents</strong> to proceed
            with the application. <strong>Optional documents</strong> are not
            required but may be uploaded if available. Only files in{" "}
            <strong>JPG, JPEG, PNG, or PDF</strong> format are allowed for
            upload. Please make sure that the file you are submitting does not
            exceed the <strong>maximum file size of 4 MB</strong>. Any file that
            goes beyond the allowed size limit or is not in the required format
            will not be accepted by the system.
            <br />
            <br />
            To avoid delays in the processing of your application, kindly review
            and verify the file’s format and size before uploading. Thank you
            for your cooperation.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 2, marginLeft: "-10px" }}>
        {Object.entries(
          requirements.reduce((acc, r) => {
            const cat = r.category || "Main";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(r);
            return acc;
          }, {}),
        ).map(([category, docs]) => (
          <Box key={category} sx={{ mt: 4 }}>
            <Container>
              <h1
                style={{
                  fontSize: "45px",
                  fontWeight: "bold",
                  textAlign: "center",
                  color: subtitleColor,
                  marginTop: "25px",
                }}
              >
                {category === "Medical"
                  ? "MEDICAL REQUIREMENTS"
                  : category === "Others"
                    ? "OTHER REQUIREMENTS"
                    : "MAIN REQUIREMENTS"}
              </h1>

              {/* 📝 Show message only below MAIN DOCUMENTS title */}
              {category !== "Medical" && category !== "Others" && (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "18px",
                    marginTop: "10px",
                    marginBottom: "30px",
                    color: "#333",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    Complete the applicant form to secure your place for the
                    upcoming academic year at{" "}
                    {shortTerm ? (
                      <>
                        <strong>{shortTerm.toUpperCase()}</strong> <br />
                        {companyName || ""}
                      </>
                    ) : (
                      companyName || ""
                    )}
                    .
                  </div>
                </div>
              )}
            </Container>

            <TableContainer
              component={Paper}
              sx={{ width: "95%", mt: 2, border: `1px solid ${borderColor}` }}
            >
              <Table>
                <TableHead
                  sx={{
                    backgroundColor: settings?.header_color || "#1976d2",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{
                        color: "white",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Document
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Upload
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Remarks
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Preview
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Delete
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {docs.map((doc) =>
                    renderRow({
                      id: doc.id,
                      label: doc.description,
                      is_required: doc.is_required,
                      is_optional: doc.is_optional,
                    }),
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default RequirementUploader;