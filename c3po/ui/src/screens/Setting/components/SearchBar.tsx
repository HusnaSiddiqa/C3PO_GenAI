import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Search, SearchIconWrapper, StyledInputBase } from './Styles/searchStyles';

type Props = {
  onSearch: (value: string) => void;
  value: string | null;
};

export const SearchBar: React.FC<Props> = ({ onSearch, value }) => {
  const [inputValue, setInputValue] = useState(value || "");

  return (
    <Search >
      <StyledInputBase
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSearch(inputValue);
          }
        }}
      />
      <SearchIconWrapper sx={{ cursor: 'pointer' }} onClick={() => onSearch(inputValue)} >
        <MagnifyingGlassIcon width={24} height={24} color="white" />
      </SearchIconWrapper>
    </Search>
  );
}
