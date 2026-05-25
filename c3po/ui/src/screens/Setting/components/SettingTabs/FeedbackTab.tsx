import React from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { ArrowCircleRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowCircleRight";
import { SearchBar } from "../SearchBar";
import { TableComponent } from "../TableComponent";
import { Box, Typography, useTheme } from "@mui/material";
import { DropDown, type DropDownOption } from "../DropDown";
import { ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFeedbackData,
  fetchUserIdsForFeedback,
  searchFeedbackData,
} from "../../helpers/helpers";
import { DateDropdown } from "../DateDropdown";
import type {
  FeedbackSearchFilter,
  FeedbackDetailsType,
} from "../../helpers/types";
import { NegativeIcon, PositiveIcon } from "../ThumbIcon";
import { FeedbackDetails } from "./feedbackDetails";

export interface FeedbackTableDataType {
  columns: { id: string; label: string }[];
  rows: Record<string, string | Object | ReactNode>[];
}

const ratingDropdownList = [
  {
    label: "All",
    value: "",
  },
  {
    label: <PositiveIcon values={"positive"} />,
    value: <PositiveIcon values={"positive"} />,
  },
  {
    label: <NegativeIcon values={"negative"} />,
    value: <NegativeIcon values={"negative"} />,
  },
];

export const FeedbackTabComponent = () => {
  const theme = useTheme();

  const { data, isLoading, isError } = useQuery<FeedbackDetailsType[]>({
    queryKey: ["feedbackDetails"],
    queryFn: fetchFeedbackData,
    throwOnError: true,
    retry: false,
  });

  const { data: userIds } = useQuery<string[]>({
    queryKey: ["userIds"],
    queryFn: fetchUserIdsForFeedback,
    throwOnError: true,
    retry: false,
  });

  const [showFeedbackDetailsFlag, setShowFeedbackDetailsFlag] =
    useState<boolean>(false);
  const [resultNotFoundFlag, setResultNotFoundFlag] = useState<boolean>(false);
  const [tableData, setTableData] = useState<FeedbackTableDataType | null>(
    null
  );
  const [formatTableData, setFormatTableData] =
    useState<FeedbackTableDataType | null>(null);
  const [userIdsDropdown, setUserIdsDropdown] = useState<DropDownOption[]>([
    { label: "", value: "All" },
  ]);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedFromDate, setSelectedFromDate] = useState<string | null>(null);
  const [selectedToDate, setSelectedToDate] = useState<string | null>(null);
  const [currentSelectedUserId, setCurrentSelectedUserId] =
    useState<string>("");
  const [currentSelectedRating, setCurrentSelectedRating] = useState<
    string | Object
  >("");
  const [selectedRow, setSelectedRow] =
    useState<Record<string, string | Object>>();
  const [searchValue, setSearchValue] = useState<string | null>(null);
  const [showAllData, setShowAllData] = useState<boolean>(true);
  const [queryParam, setQueryParam] = useState<string>();
  const queryClient = useQueryClient();

  const showFeedback = (row: Record<string, string | Object>) => {
    setShowFeedbackDetailsFlag(true);
    setSelectedRow(row);
  };

  const handleBackButtonClick = async (showFeedbackTable: boolean) => {
    setShowFeedbackDetailsFlag(!showFeedbackTable);

    if (queryParam) {
      // If filters are active, re-run the search to get fresh data including any updates
      searchFilters(queryParam);
    } else {
      queryClient.invalidateQueries({ queryKey: ["feedbackDetails"] });
    }
  };

  // Transform data
  const transformFeedbackData = (
    feedbackData: FeedbackDetailsType[]
  ): FeedbackTableDataType => {
    if (!feedbackData || feedbackData.length === 0)
      return { columns: [], rows: [] };

    const entry = feedbackData[0];
    const columns = Object.keys(entry)
      .filter((key) => key !== "conversation_id") // Hide the Conversation Id column
      .map((key) => {
        const label = key
          .replace(/_/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/\b\w/g, (char: string) => char.toUpperCase());

        return { id: key, label };
      });

    const rows: Record<string, string | Object>[] = feedbackData.map(
      (item: Record<string, string | Object>) => {
        const row: Record<string, string | Object> = {};
        columns.forEach((col) => {
          switch (col.id) {
            case "rating":
              row[col.id] =
                item.rating === "positive" ? (
                  <PositiveIcon values={"positive"} />
                ) : (
                  <NegativeIcon values={"negative"} />
                );
              break;
            case "date":
              row[col.id] =
                typeof item.date === "string" || typeof item.date === "number"
                  ? new Date(item.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "";
              break;
            case "id":
              row[col.id] = (
                <ArrowCircleRightIcon
                  cursor={"pointer"}
                  values={item[col.id].toString()}
                  size={32}
                  onClick={() => showFeedback(item)}
                />
              );
              break;

            default:
              row[col.id] = item[col.id];
          }
        });

        return row;
      }
    );

    return { columns, rows };
  };

  // search data
  const { mutate: searchFilters } = useMutation({
    mutationFn: searchFeedbackData,
    onSuccess: (data) => {
      if (data.length === 0) {
        setResultNotFoundFlag(true);
      } else {
        setResultNotFoundFlag(false);
        const transformedFeedbackData: FeedbackTableDataType =
          transformFeedbackData(data);
        setFormatTableData(transformedFeedbackData);
      }
    },
    onError: () => {
      return tableData;
    },
  });

  // load  feedback data
  useEffect(() => {
    if (data) {
      const transformedFeedbackData: FeedbackTableDataType =
        transformFeedbackData(data);
      setTableData(transformedFeedbackData);
      setFormatTableData(transformedFeedbackData);
    }
    if (userIds && Array.isArray(userIds)) {
      const userIdsDropdown: DropDownOption[] = [
        { label: "All", value: "" },
        ...userIds.map((item: string) => ({
          label: item,
          value: item,
        })),
      ];
      setUserIdsDropdown(userIdsDropdown);
    }
  }, [data, userIds]);

  useEffect(() => {
    const newFilterData: FeedbackSearchFilter = {
      search: searchValue || "",
      user_id: currentSelectedUserId || "",
      rating:
        typeof currentSelectedRating === "object" &&
        currentSelectedRating !== null &&
        "props" in currentSelectedRating
          ? (currentSelectedRating as any).props.values
          : "",
      date_from: selectedFromDate || "",
      date_to: selectedToDate || "",
    };

    const hasFilters =
      newFilterData.search ||
      newFilterData.user_id ||
      newFilterData.rating ||
      newFilterData.date_from ||
      newFilterData.date_to;
    setResultNotFoundFlag(false);

    if (hasFilters) {
      const params = new URLSearchParams();
      Object.entries(newFilterData).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          params.append(key, value);
        }
      });
      const finalURL = `?${params.toString()}`;
      setQueryParam(finalURL);
    } else {
      // Clear query param when no filters are active to show full data
      setQueryParam(undefined);
      if (data) {
        const transformedFeedbackData: FeedbackTableDataType =
          transformFeedbackData(data);
        setFormatTableData(transformedFeedbackData);
        setTableData(transformedFeedbackData);
      }
    }
  }, [
    searchValue,
    currentSelectedUserId,
    currentSelectedRating,
    selectedFromDate,
    selectedToDate,
    showAllData,
    data, // Add data dependency to ensure proper re-evaluation
  ]);

  useEffect(() => {
    if (queryParam) {
      searchFilters(queryParam);
    }
  }, [queryParam]);

  useEffect(() => {
    if (!showFeedbackDetailsFlag && formatTableData) {
      setTableData(formatTableData);
    }
  }, [showFeedbackDetailsFlag, formatTableData]);

  const handleDateSelection = (payload) => {
    const { from, to }: { from: string | null; to: string | null } =
      payload.range;
    setShowAllData(payload.showAllData);
    setSelectedFromDate(from);
    setSelectedToDate(to);
  };

  const NoResultFound = () => {
    return (
      <Box
        sx={{
          display: "flex",
          height: "607px",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "4px",
          alignSelf: "stretch",
        }}
      >
        <Typography
          style={{
            color: theme.palette.contrast.grayscale.level75,
            textAlign: "center",
            fontFeatureSettings: "'liga' off, 'clig' off",

            /* Headline/font-h5 */
            fontFamily: "Proxima Nova",
            fontSize: "18px",
            fontStyle: "normal",
            fontWeight: 700,
            lineHeight: "normal",
          }}
        >
          {" "}
          No result found{" "}
        </Typography>
        <Typography
          sx={{
            color: theme.palette.contrast.grayscale.level75,
            textAlign: "center",
            fontFeatureSettings: "'liga' off, 'clig' off",

            /* Paragraph/font-p1 */
            fontFamily: "Proxima Nova",
            fontSize: "18px",
            fontStyle: "normal",
            fontWeight: 400,
            lineHeight: "normal",
          }}
        >
          {" "}
          Try a different Keyword
        </Typography>
      </Box>
    );
  };
  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (isError) {
    return (
      <Typography color="error">Failed to load feedback details</Typography>
    );
  }

  const handleSearch = (value: string) => {
    if (value) {
      setSearchValue(value);
    }
  };

  return (
    <>
      {showFeedbackDetailsFlag && selectedRow ? (
        <FeedbackDetails
          selectedRowData={selectedRow}
          showFeedbackDetailsFlag={showFeedbackDetailsFlag}
          onBackButtonClick={handleBackButtonClick}
        />
      ) : (
        tableData && (
          <>
            <Box
              sx={{
                display: "flex",
                padding: "12px",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                width: "100%",
                gap: 2,
              }}
            >
              <SearchBar value={searchValue} onSearch={handleSearch} />
              <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
                <DropDown
                  placeholder={"User Id: All"}
                  value={currentSelectedUserId}
                  options={userIdsDropdown}
                  onChange={(value) =>
                    setCurrentSelectedUserId(value ? value.toString() : "")
                  }
                  padding="9.5px 12px"
                  width={250}
                  feedbackScreen={true}
                />
                <DropDown
                  placeholder={`Rating: All`}
                  value={currentSelectedRating}
                  options={ratingDropdownList}
                  onChange={(value) =>
                    setCurrentSelectedRating(value ? value : "")
                  }
                  padding="9.5px 12px"
                  width={120}
                  feedbackScreen={true}
                />
                <DateDropdown
                  onChange={(payload: {
                    range: { from: string | null; to: string | null };
                    showAllData: boolean;
                  }) => {
                    handleDateSelection(payload);
                  }}
                />
              </Box>
            </Box>

            <Box
              display="flex"
              alignItems="center"
              flexWrap="wrap"
              padding={5}
              sx={{
                display: "flex",
                padding: "12px",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "12px",
                alignSelf: "stretch",
                minHeight: 500,
              }}
            >
              <Box display="flex" position="relative">
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.contrast.grayscale.level100,
                    fontFeatureSettings: "'liga' off, 'clig' off",
                    fontFamily: "Proxima Nova",
                    fontSize: "14px",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "normal",
                  }}
                >
                  Showing Last 3 months list
                </Typography>
                <InfoIcon
                  onClick={() => setShowInfo((prev) => !prev)}
                  weight="fill"
                  style={{
                    color: theme.palette.contrast.grayscale.level50,
                    marginTop: 2,
                    marginLeft: 2,
                    width: "12px",
                    height: "12px",
                    aspectRatio: "1/1",
                  }}
                />
                {showInfo && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: "100%",
                      left: 150,
                      background: theme.palette.contrast.grayscale.level0,
                      border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                      padding: "8px",
                      zIndex: 10,
                      height: "40px",
                      width: "450px",
                      mt: 1,
                    }}
                  >
                    <Typography
                      style={{
                        color: theme.palette.contrast.grayscale.level100,
                        fontFeatureSettings: "'liga' off, 'clig' off",
                        fontFamily: "Proxima Nova",
                        fontSize: "14px",
                        fontStyle: "normal",
                        fontWeight: "400",
                        lineHeight: "20px",
                      }}
                    >
                      For feedback older than 30 days, please contact
                      xyz@gilead.com
                    </Typography>
                  </Box>
                )}
              </Box>
              {resultNotFoundFlag ? (
                <NoResultFound />
              ) : (
                <TableComponent data={tableData} />
              )}
            </Box>
          </>
        )
      )}
    </>
  );
};
