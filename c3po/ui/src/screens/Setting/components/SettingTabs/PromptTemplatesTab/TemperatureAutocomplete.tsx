import { InputAdornment, TextField } from "@mui/material";

function TemperatureAutocomplete({
  temperature,
  setTemperature,
  required,
  error
}: {
  temperature: string,
  setTemperature: (value: string) => void,
  required?: boolean,
  error?: boolean,
}) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    if (value === '' || value === '-') {
      setTemperature(value);
      return;
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      return;
    }

    if (numValue < 0) {
      setTemperature('0');
    } else if (numValue > 1) {
      setTemperature('1');
    } else {
      setTemperature(value);
    }
  };

  return (
    <TextField
      size="small"
      label="Temperature"
      required={required}
      value={temperature}
      error={error}
      onChange={handleChange}
      type="number"
      slotProps={{
        input: {
          startAdornment:
            <InputAdornment position="start">
              Temperature:&nbsp;
            </InputAdornment>,
        },
        htmlInput: {
          min: 0,
          max: 1,
          step: 0.01
        },
      }}
    />
  )
}

export default TemperatureAutocomplete;