import React from "react";
import api from "../../services/api";

const AttachmentUpload = ({ fundRequestId }) => {
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    api.post(`/attachments/${fundRequestId}`, formData)
      .then(() => alert("Uploaded!"));
  };
  return <input type="file" onChange={handleUpload} />;
};

export default AttachmentUpload;
