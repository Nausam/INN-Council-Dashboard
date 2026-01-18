"use client";

import DirectoryItemForm, {
  DirectoryItemFormValues,
} from "@/components/council-app/DirectoryItemForm";
import { servicesCompetitionsService } from "@/lib/appwrite/app/services.actions";
import { useRouter } from "next/navigation";

export default function NewNinmunPage() {
  const router = useRouter();

  const onSubmit = async (values: DirectoryItemFormValues) => {
    const res = await servicesCompetitionsService.createItem({
      kind: values.kind,
      title: values.title,
      description: values.description,
      category: values.category || null,
      published: values.published,
    });

    if (res.success) router.push("/admin/services-competitions");
    else alert(res.error || "Failed to create");
  };
  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      {/* <CouncilNinmunCreateForm /> */}
      {/* <IulaanCreateForm /> */}
      <DirectoryItemForm mode="create" onSubmit={onSubmit} />
    </div>
  );
}
