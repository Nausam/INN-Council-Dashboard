"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createRegistration, uploadImage } from "@/lib/actions/waste.actions";
import Image from "next/legacy/image";
import { createRegistrationSchema } from "@/lib/validations";
import { Registration } from "@/types";
import { registrationDefaultValues } from "@/constants";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Dropdown from "./Dropdown";
import { FileUploader } from "./FileUploader";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

type ProductFormProps = {
  type: "Create" | "Update";
  registration?: Registration;
  productId?: string;
};

const WasteRegistrationForm = ({
  type,
  registration,
  productId,
}: ProductFormProps) => {
  const [file, setFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  console.log("product", registration);

  const initialValues =
    registration && type === "Update"
      ? {
          ...registration,
        }
      : registrationDefaultValues;

  const form = useForm<z.infer<typeof createRegistrationSchema>>({
    resolver: zodResolver(createRegistrationSchema),
    defaultValues: initialValues,
  });

  const handleSubmit = async (
    values: z.infer<typeof createRegistrationSchema>
  ) => {
    setIsSubmitting(true);

    try {
      let idCard = registration?.idCard || ""; // Use existing image URL if no new file is uploaded

      if (file) {
        // Upload the file only if a new file is selected
        idCard = await uploadImage(file);
      }

      if (type === "Create") {
        // Creating a new product
        const newProduct = await createRegistration({
          fullName: values.fullName,
          address: values.address,
          idCard,
          contactNumber: parseFloat(String(values.contactNumber)),
          isCitizen: values.isCitizen,
          isCompany: values.isCompany,
          isRetailer: values.isRetailer,
        });

        if (newProduct) {
          form.reset();
          router.push(`/shop/${newProduct.id}`);
          alert("Product created successfully!");
        }
      } else if (type === "Update") {
        if (!productId) {
          router.back();
          return;
        }
      }
    } catch (error) {
      console.error(
        `Failed to ${type === "Create" ? "create" : "update"} product:`,
        error
      );

      toast({
        title: `Failed to ${type === "Create" ? "create" : "update"} product`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-5 md:flex-row">
          {/* Full Name */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    placeholder="Full Name"
                    {...field}
                    className="input-field"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    placeholder="Address"
                    {...field}
                    className="input-field"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Price */}
          <FormField
            control={form.control}
            name="contactNumber"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <div className="flex-center h-[55px] w-full overflow-hidden rounded-sm bg-grey-50 dark:bg-[#191919] px-4 py-2">
                    {/* <Image
                      src="/assets/icons/dollar.svg"
                      alt="price"
                      width={24}
                      height={24}
                    /> */}
                    <Input
                      type="number"
                      placeholder="Contact Number"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="p-regular-16 border-0 bg-grey-50 dark:bg-[#191919] outline-offset-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-5 md:flex-row ">
          {/* Image Upload */}
          <FormField
            control={form.control}
            name="idCard"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl className="h-72">
                  <FileUploader
                    onFieldChange={field.onChange}
                    imageUrl={field.value}
                    setFile={setFile}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
        <div className="flex w-full justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="button bg-black border border-black hover:bg-transparent text-white hover:text-black dark:bg-white dark:border-black dark:hover:border-white dark:text-black dark:hover:bg-transparent dark:hover:text-white  font-bold w-full sm:w-fit transition-all duration-300 ease-in-out shadow-lg"
          >
            {form.formState.isSubmitting ? "Submitting..." : "Register"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default WasteRegistrationForm;
