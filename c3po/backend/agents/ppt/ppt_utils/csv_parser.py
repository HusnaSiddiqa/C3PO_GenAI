"""
CSV Parser Utility

This module provides enhanced CSV parsing capabilities with automatic
data type detection, validation, and preprocessing for PowerPoint generation.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import os
from pathlib import Path


class CSVParser:
    """
    Enhanced CSV parser with automatic data type detection and validation.
    """
    
    def __init__(self):
        self.supported_encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
        self.date_formats = [
            '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S',
            '%m/%d/%Y %H:%M:%S', '%d/%m/%Y %H:%M:%S', '%Y%m%d'
        ]
    
    def parse_csv(
        self, 
        file_path: str, 
        auto_detect_types: bool = True,
        validate_data: bool = True,
        sample_size: Optional[int] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Parse CSV file with enhanced error handling and type detection.
        
        Args:
            file_path: Path to the CSV file
            auto_detect_types: Whether to automatically detect and convert data types
            validate_data: Whether to perform data validation
            sample_size: Number of rows to sample for large files (None for all)
            
        Returns:
            Tuple of (DataFrame, metadata_dict)
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path}")
        
        # Initialize metadata
        metadata = {
            'file_path': file_path,
            'file_size_mb': os.path.getsize(file_path) / (1024 * 1024),
            'encoding_used': None,
            'parsing_errors': [],
            'data_quality_issues': [],
            'original_dtypes': {},
            'converted_dtypes': {},
            'row_count': 0,
            'column_count': 0
        }
        
        # Try different encodings
        df = None
        for encoding in self.supported_encodings:
            try:
                df = self._read_csv_with_encoding(file_path, encoding, sample_size)
                metadata['encoding_used'] = encoding
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                metadata['parsing_errors'].append(f"Encoding {encoding}: {str(e)}")
        
        if df is None:
            raise ValueError(f"Could not read CSV file with any supported encoding. Errors: {metadata['parsing_errors']}")
        
        # Store original data types
        metadata['original_dtypes'] = df.dtypes.to_dict()
        metadata['row_count'] = len(df)
        metadata['column_count'] = len(df.columns)
        
        # Auto-detect and convert data types
        if auto_detect_types:
            df = self._auto_detect_types(df, metadata)
        
        # Validate data quality
        if validate_data:
            self._validate_data_quality(df, metadata)
        
        # Clean and preprocess
        df = self._preprocess_data(df, metadata)
        
        return df, metadata
    
    def _read_csv_with_encoding(self, file_path: str, encoding: str, sample_size: Optional[int]) -> pd.DataFrame:
        """Read CSV with specific encoding and sampling."""
        read_kwargs = {
            'encoding': encoding,
            'low_memory': False,
            'na_values': ['', 'NA', 'N/A', 'null', 'NULL', 'None', '#N/A', '#NULL!']
        }
        
        if sample_size:
            # Read a sample for large files
            read_kwargs['nrows'] = sample_size
        
        return pd.read_csv(file_path, **read_kwargs)
    
    def _auto_detect_types(self, df: pd.DataFrame, metadata: Dict[str, Any]) -> pd.DataFrame:
        """Automatically detect and convert data types."""
        df_converted = df.copy()
        conversion_log = {}
        
        for column in df.columns:
            original_dtype = df[column].dtype
            converted_dtype = self._detect_column_type(df[column])
            
            if converted_dtype != original_dtype:
                try:
                    if converted_dtype == 'datetime':
                        df_converted[column] = self._convert_to_datetime(df[column])
                    elif converted_dtype == 'numeric':
                        df_converted[column] = pd.to_numeric(df[column], errors='coerce')
                    elif converted_dtype == 'boolean':
                        df_converted[column] = self._convert_to_boolean(df[column])
                    elif converted_dtype == 'category':
                        df_converted[column] = df[column].astype('category')
                    
                    conversion_log[column] = {
                        'from': str(original_dtype),
                        'to': str(df_converted[column].dtype)
                    }
                except Exception as e:
                    metadata['parsing_errors'].append(f"Type conversion failed for {column}: {str(e)}")
        
        metadata['converted_dtypes'] = df_converted.dtypes.to_dict()
        metadata['type_conversions'] = conversion_log
        
        return df_converted
    
    def _detect_column_type(self, series: pd.Series) -> str:
        """Detect the most appropriate data type for a column."""
        # Skip if already numeric
        if pd.api.types.is_numeric_dtype(series):
            return 'numeric'
        
        # Remove missing values for analysis
        non_null_series = series.dropna()
        if len(non_null_series) == 0:
            return 'object'
        
        # Check for datetime
        if self._is_datetime_column(non_null_series):
            return 'datetime'
        
        # Check for numeric (including strings that represent numbers)
        if self._is_numeric_column(non_null_series):
            return 'numeric'
        
        # Check for boolean
        if self._is_boolean_column(non_null_series):
            return 'boolean'
        
        # Check if should be categorical (limited unique values)
        unique_ratio = len(non_null_series.unique()) / len(non_null_series)
        if unique_ratio < 0.5 and len(non_null_series.unique()) < 50:
            return 'category'
        
        return 'object'
    
    def _is_datetime_column(self, series: pd.Series) -> bool:
        """Check if column contains datetime values."""
        sample_size = min(100, len(series))
        sample = series.head(sample_size)
        
        for date_format in self.date_formats:
            try:
                pd.to_datetime(sample, format=date_format, errors='raise')
                return True
            except:
                continue
        
        # Try general datetime parsing
        try:
            parsed = pd.to_datetime(sample, errors='coerce')
            valid_dates = parsed.notna().sum()
            return valid_dates / len(sample) > 0.8
        except:
            return False
    
    def _is_numeric_column(self, series: pd.Series) -> bool:
        """Check if column contains numeric values."""
        try:
            pd.to_numeric(series, errors='raise')
            return True
        except:
            # Check percentage of values that can be converted
            try:
                converted = pd.to_numeric(series, errors='coerce')
                valid_numbers = converted.notna().sum()
                return valid_numbers / len(series) > 0.8
            except:
                return False
    
    def _is_boolean_column(self, series: pd.Series) -> bool:
        """Check if column contains boolean values."""
        unique_values = set(str(v).lower() for v in series.unique())
        boolean_patterns = {
            {'true', 'false'},
            {'yes', 'no'},
            {'y', 'n'},
            {'1', '0'},
            {'on', 'off'},
            {'enabled', 'disabled'}
        }
        
        return any(unique_values.issubset(pattern) for pattern in boolean_patterns)
    
    def _convert_to_datetime(self, series: pd.Series) -> pd.Series:
        """Convert series to datetime with format detection."""
        for date_format in self.date_formats:
            try:
                return pd.to_datetime(series, format=date_format, errors='raise')
            except:
                continue
        
        # Fallback to general parsing
        return pd.to_datetime(series, errors='coerce')
    
    def _convert_to_boolean(self, series: pd.Series) -> pd.Series:
        """Convert series to boolean values."""
        series_str = series.astype(str).str.lower()
        
        # Create mapping
        bool_mapping = {
            'true': True, 'false': False,
            'yes': True, 'no': False,
            'y': True, 'n': False,
            '1': True, '0': False,
            'on': True, 'off': False,
            'enabled': True, 'disabled': False
        }
        
        return series_str.map(bool_mapping)
    
    def _validate_data_quality(self, df: pd.DataFrame, metadata: Dict[str, Any]) -> None:
        """Validate data quality and log issues."""
        issues = []
        
        # Check for completely empty columns
        empty_columns = df.columns[df.isnull().all()].tolist()
        if empty_columns:
            issues.append(f"Completely empty columns: {empty_columns}")
        
        # Check for duplicate rows
        duplicate_count = df.duplicated().sum()
        if duplicate_count > 0:
            issues.append(f"Duplicate rows: {duplicate_count} ({duplicate_count/len(df)*100:.1f}%)")
        
        # Check for columns with single unique value
        single_value_columns = []
        for col in df.columns:
            if df[col].nunique() == 1:
                single_value_columns.append(col)
        if single_value_columns:
            issues.append(f"Columns with single value: {single_value_columns}")
        
        # Check for high missing value percentages
        high_missing_columns = []
        for col in df.columns:
            missing_pct = df[col].isnull().sum() / len(df) * 100
            if missing_pct > 50:
                high_missing_columns.append(f"{col} ({missing_pct:.1f}%)")
        if high_missing_columns:
            issues.append(f"High missing value columns: {high_missing_columns}")
        
        # Check for potential outliers in numeric columns
        outlier_columns = []
        for col in df.select_dtypes(include=[np.number]).columns:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = len(df[(df[col] < Q1 - 3*IQR) | (df[col] > Q3 + 3*IQR)])
            if outliers > len(df) * 0.1:  # More than 10% outliers
                outlier_columns.append(f"{col} ({outliers} outliers)")
        if outlier_columns:
            issues.append(f"Columns with many outliers: {outlier_columns}")
        
        metadata['data_quality_issues'] = issues
    
    def _preprocess_data(self, df: pd.DataFrame, metadata: Dict[str, Any]) -> pd.DataFrame:
        """Basic preprocessing of the data."""
        df_processed = df.copy()
        
        # Remove completely empty rows and columns
        df_processed = df_processed.dropna(how='all')  # Remove empty rows
        df_processed = df_processed.loc[:, ~df_processed.isnull().all()]  # Remove empty columns
        
        # Clean column names
        df_processed.columns = [self._clean_column_name(col) for col in df_processed.columns]
        
        # Handle infinite values in numeric columns
        numeric_columns = df_processed.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            df_processed[col] = df_processed[col].replace([np.inf, -np.inf], np.nan)
        
        return df_processed
    
    def _clean_column_name(self, column_name: str) -> str:
        """Clean and standardize column names."""
        # Convert to string and strip whitespace
        name = str(column_name).strip()
        
        # Replace spaces and special characters with underscores
        import re
        name = re.sub(r'[^\w\s]', '_', name)
        name = re.sub(r'\s+', '_', name)
        
        # Remove multiple consecutive underscores
        name = re.sub(r'_+', '_', name)
        
        # Remove leading/trailing underscores
        name = name.strip('_')
        
        # Ensure it doesn't start with a number
        if name and name[0].isdigit():
            name = 'col_' + name
        
        return name if name else 'unnamed_column'
    
    def get_data_profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate a comprehensive data profile."""
        profile = {
            'basic_info': {
                'rows': len(df),
                'columns': len(df.columns),
                'memory_usage_mb': df.memory_usage(deep=True).sum() / (1024 * 1024),
                'column_names': list(df.columns)
            },
            'data_types': {
                'numeric': list(df.select_dtypes(include=[np.number]).columns),
                'categorical': list(df.select_dtypes(include=['object', 'category']).columns),
                'datetime': list(df.select_dtypes(include=['datetime64']).columns),
                'boolean': list(df.select_dtypes(include=['bool']).columns)
            },
            'missing_data': {
                'total_missing': df.isnull().sum().sum(),
                'missing_by_column': df.isnull().sum().to_dict(),
                'missing_percentage': (df.isnull().sum() / len(df) * 100).to_dict()
            },
            'unique_values': df.nunique().to_dict(),
            'sample_data': df.head(5).to_dict('records')
        }
        
        # Add numeric statistics
        numeric_df = df.select_dtypes(include=[np.number])
        if not numeric_df.empty:
            profile['numeric_stats'] = numeric_df.describe().to_dict()
        
        # Add categorical statistics
        categorical_df = df.select_dtypes(include=['object', 'category'])
        if not categorical_df.empty:
            profile['categorical_stats'] = {}
            for col in categorical_df.columns[:5]:  # Limit to first 5
                value_counts = df[col].value_counts().head(10)
                profile['categorical_stats'][col] = value_counts.to_dict()
        
        return profile
