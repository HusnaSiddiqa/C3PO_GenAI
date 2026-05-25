import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Login from '../../sso/Login';

describe('Login Component', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
     Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('should display redirecting message', () => {
    render(<Login />);
    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
  });

  it('should set window.location.href to the auth URL', () => {
    render(<Login />);
    expect(window.location.href).toContain('?client_id');
  });
});
