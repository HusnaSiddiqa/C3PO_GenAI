import { useQuery } from "@tanstack/react-query";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { fetchPromptDetails } from "../../../helpers/helpers";
import { DropDown } from "../../DropDown";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { useSelectedAgentDetails } from "./context/SelectedAgentDetailsContext";
import { useInitialAgentDetails } from "./context/InitialAgentDetailsContext";
import { omit, pick } from "lodash";

const VersionDropDown = ({
  setIsBodySectionDisabled,
}: {
  setIsBodySectionDisabled: Dispatch<SetStateAction<boolean>>;
}) => {
  const [fetchPromptDetailsQueryCallFlag, setFetchPromptDetailsQueryCallFlag] =
    useState(false);
  const { selectedAgent: currentSelectedAgent } = useSelectedAgent();
  const { setInitialAgentDetails: setInitialAgentDetailsState } = useInitialAgentDetails();
  const { selectedAgentDetails, setSelectedAgentDetails: setAgentDetails } = useSelectedAgentDetails();

  const {
    data: promptDetails,
    isLoading: isLoadingPromptDetails,
    // error,  //TODO: add the error state here
  } = useQuery({
    queryKey: [
      "promptDetails",
      currentSelectedAgent?.id,
      selectedAgentDetails.versionAlias,
    ],
    queryFn: () =>
      fetchPromptDetails(
        currentSelectedAgent?.name ?? "",
        selectedAgentDetails.versionAlias
      ),
    enabled:
      Boolean(currentSelectedAgent?.id) &&
      Boolean(selectedAgentDetails.versionAlias) &&
      fetchPromptDetailsQueryCallFlag,
    retry: false,
    throwOnError: true,
  });

  useEffect(() => {
    setIsBodySectionDisabled(isLoadingPromptDetails);
  }, [isLoadingPromptDetails, setIsBodySectionDisabled]);

  useEffect(() => {
    if (promptDetails) {
      setAgentDetails((prev) => ({
        ...pick(prev, ['versions']),
        ...omit(promptDetails, ['agent'])
      }));
      setInitialAgentDetailsState((prev) => ({
        ...pick(prev, ['versions']),
        ...omit(promptDetails, ['agent'])
      }));
    }
  }, [promptDetails, setAgentDetails, setInitialAgentDetailsState]);

  return (
    <DropDown
      placeholder="Version:"
      value={selectedAgentDetails.versionAlias}
      options={
        selectedAgentDetails?.versions.map((version) => ({
          label: version,
          value: version,
        })) ?? []
      }
      onChange={(version) => {
        setAgentDetails((prev) => ({
          ...prev,
          versionAlias: version ? version.toString() : "",
        }));
        setFetchPromptDetailsQueryCallFlag(true);
      }}
      padding="9.5px 12px"
      feedbackScreen={false}
    />
  );
};

export default VersionDropDown;
