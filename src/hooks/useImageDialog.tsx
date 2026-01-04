import { useContext } from "react";
import { ImageDialogContext } from "../context/ImageDialogContext";

export const useImageDialog = () => {
  const context = useContext(ImageDialogContext);
  if (!context) {
    throw new Error("useImageDialog must be used within ImageDialogProvider");
  }
  return context;
};
