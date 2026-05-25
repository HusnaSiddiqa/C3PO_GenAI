import { useMutation } from "@tanstack/react-query";
import { authFetch } from "../../../../../helpers/authFetch";

type UpdateDataPayload = {
  conversation_id: string;
  title: string;
};

type UpdateDataResult = {
  conversation_id: string;
  title: string;
  message: string;
};
const updateData = async (
  payload: UpdateDataPayload
): Promise<UpdateDataResult> => {
  const res = await authFetch("/v2/chat-manager/conversation/title", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to update");
  }

  return res.json();
};

export const UpdateTitleData = () => {
  return useMutation({
    mutationFn: updateData,
    onSuccess: () => {
      console.log("Data updated successfully");
    },
    onError: (error) => {
      console.error("Update failed:", error);
    },
  });
};
