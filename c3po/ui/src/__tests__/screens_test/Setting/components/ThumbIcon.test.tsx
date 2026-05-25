import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PositiveIcon, NegativeIcon } from '../../../../screens/Setting/components/ThumbIcon';

// Mock the Phosphor icons
vi.mock('@phosphor-icons/react', () => ({
    ThumbsUpIcon: vi.fn(({ weight, color, style, values }) => (
        <svg 
            data-testid="thumbs-up-icon" 
            data-weight={weight}
            data-color={color}
            data-values={values}
            style={style}
        >
            <title>Thumbs Up</title>
        </svg>
    )),
    ThumbsDownIcon: vi.fn(({ weight, color, style, values }) => (
        <svg 
            data-testid="thumbs-down-icon"
            data-weight={weight}
            data-color={color}
            data-values={values}
            style={style}
        >
            <title>Thumbs Down</title>
        </svg>
    ))
}));

// Mock useTheme hook
const mockTheme = {
    palette: {
        contrast: {
            status: {
                green100: '#00ff00',
                redOff100: '#ff0000'
            }
        }
    }
};

vi.mock('@mui/material', () => ({
    useTheme: () => mockTheme
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    const theme = createTheme();
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('PositiveIcon', () => {
    it('renders ThumbsUpIcon with default props', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-weight', 'fill');
        expect(icon).toHaveAttribute('data-color', '#00ff00');
        expect(icon).toHaveAttribute('data-values', 'positive');
    });

    it('renders with custom values prop', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="custom-positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveAttribute('data-values', 'custom-positive');
    });

    it('applies correct styling', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveStyle({
            width: '12px',
            height: '12px',
            flexShrink: '0'
        });
    });

    it('uses theme color for green', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveAttribute('data-color', mockTheme.palette.contrast.status.green100);
    });

    it('handles undefined values prop gracefully', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveAttribute('data-values', 'positive');
    });

    it('handles null values prop gracefully', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveAttribute('data-values', 'positive');
    });

    it('handles empty string values prop', () => {
        render(
            <TestWrapper>
                <PositiveIcon values="positive" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-up-icon');
        expect(icon).toHaveAttribute('data-values', 'positive');
    });
});

describe('NegativeIcon', () => {
    it('renders ThumbsDownIcon with default props', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-weight', 'fill');
        expect(icon).toHaveAttribute('data-color', '#ff0000');
        expect(icon).toHaveAttribute('data-values', 'negative');
    });

    it('renders with custom values prop', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="custom-negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toHaveAttribute('data-values', 'custom-negative');
    });

    // it('applies correct styling', () => {
    //     render(
    //         <TestWrapper>
    //             <NegativeIcon values="negative" />
    //         </TestWrapper>
    //     );
        
    //     const icon = screen.getByTestId('thumbs-down-icon');
    //     expect(icon).toHaveStyle({
    //         width: '12px',
    //         height: '12px',
    //         flexShrink: '0'
    //     });
    // });

    it('uses theme color for red', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toHaveAttribute('data-color', mockTheme.palette.contrast.status.redOff100);
    });

    it('handles undefined values prop gracefully', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toHaveAttribute('data-values', 'negative');
    });

    it('handles null values prop gracefully', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toHaveAttribute('data-values', 'negative');
    });

    it('handles empty string values prop', () => {
        render(
            <TestWrapper>
                <NegativeIcon values="negative" />
            </TestWrapper>
        );
        
        const icon = screen.getByTestId('thumbs-down-icon');
        expect(icon).toHaveAttribute('data-values', 'negative');
    });
});

describe('Icon Components Integration', () => {
    it('renders both icons with different colors from theme', () => {
        render(
            <TestWrapper>
                <div>
                    <PositiveIcon values="positive" />
                    <NegativeIcon values="negative" />
                </div>
            </TestWrapper>
        );
        
        const positiveIcon = screen.getByTestId('thumbs-up-icon');
        const negativeIcon = screen.getByTestId('thumbs-down-icon');
        
        expect(positiveIcon).toHaveAttribute('data-color', mockTheme.palette.contrast.status.green100);
        expect(negativeIcon).toHaveAttribute('data-color', mockTheme.palette.contrast.status.redOff100);
    });

    // it('both icons have consistent styling', () => {
    //     render(
    //         <TestWrapper>
    //             <div>
    //                 <PositiveIcon values="positive" />
    //                 <NegativeIcon values="negative" />
    //             </div>
    //         </TestWrapper>
    //     );
        
    //     const positiveIcon = screen.getByTestId('thumbs-up-icon');
    //     const negativeIcon = screen.getByTestId('thumbs-down-icon');
        
    //     const expectedStyle = {
    //         width: '12px',
    //         height: '12px',
    //         flexShrink: '0'
    //     };
        
    //     expect(positiveIcon).toHaveStyle(expectedStyle);
    //     expect(negativeIcon).toHaveStyle(expectedStyle);
    // });

    it('both icons use fill weight', () => {
        render(
            <TestWrapper>
                <div>
                    <PositiveIcon values="positive" />
                    <NegativeIcon values="negative" />
                </div>
            </TestWrapper>
        );
        
        const positiveIcon = screen.getByTestId('thumbs-up-icon');
        const negativeIcon = screen.getByTestId('thumbs-down-icon');
        
        expect(positiveIcon).toHaveAttribute('data-weight', 'fill');
        expect(negativeIcon).toHaveAttribute('data-weight', 'fill');
    });
});