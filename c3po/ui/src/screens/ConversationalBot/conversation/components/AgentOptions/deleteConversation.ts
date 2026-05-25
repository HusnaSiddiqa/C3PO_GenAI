import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "../../../../../helpers/authFetch";

const deleteConversation = async (id: string) => {
  const res = await authFetch(`/v2/chat-manager/conversation/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete conversation");
  }
};

export const DeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),

    // Refresh chat history after delete
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-history"] });
    },
  });
};
