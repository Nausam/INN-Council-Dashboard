"use client";

import { Dispatch, SetStateAction, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/legacy/image";
import { convertFileToUrl } from "@/lib/utils";

type FileUploaderProps = {
  onFieldChange: (url: string) => void;
  imageUrl: string | undefined;
  setFile: Dispatch<SetStateAction<File | null>>; // Accepts a single file
};

export function FileUploader({
  imageUrl,
  onFieldChange,
  setFile,
}: FileUploaderProps) {
  const onDrop = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile); // Update the state with the selected file

      // Create a preview URL for the file
      const fileUrl = URL.createObjectURL(selectedFile);
      onFieldChange(fileUrl); // Update the form with the image URL
    }
  }, []);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onDropHandler = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;

    if (files && files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile); // Update the state with the dragged file

      // Create a preview URL for the file
      const fileUrl = URL.createObjectURL(selectedFile);
      onFieldChange(fileUrl); // Update the form with the image URL
    }
  };

  return (
    <div
      className="flex-center bg-dark-3 h-64 flex p-3 cursor-pointer flex-col overflow-hidden rounded-sm bg-grey-50 dark:bg-[#191919]"
      onDragOver={onDragOver}
      onDrop={onDropHandler}
    >
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        onChange={onDrop}
        className="hidden"
        id="file-upload"
      />

      {imageUrl ? (
        <div className="flex h-full w-full flex-1 justify-center">
          <Image
            src={imageUrl}
            alt="Uploaded file"
            width={250}
            height={250}
            className="w-full object-cover object-center rounded-sm"
          />
        </div>
      ) : (
        <label
          htmlFor="file-upload"
          className="flex-center flex-col py-5 text-grey-500 cursor-pointer"
        >
          <Image
            src="/assets/icons/upload.svg"
            width={77}
            height={77}
            alt="file upload"
          />
          <h3 className="mb-2 mt-2">Drag photo here</h3>
          <p className="p-medium-12 mb-4">SVG, PNG, JPG : MAX 10MB</p>
          <Button
            type="button"
            className="rounded-full dark:bg-[#252525] bg-gray-400 hover:bg-gray-500 dark:hover:bg-[#393939] text-white"
            onClick={() => document.getElementById("file-upload")?.click()} // Simulate click on hidden file input
          >
            Select from computer
          </Button>
        </label>
      )}
    </div>
  );
}
