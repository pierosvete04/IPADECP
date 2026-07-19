'use client';

import { useId, useState } from 'react';

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="campo-pass">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="toggle-pass"
          aria-label="Mostrar contraseña"
          onClick={() => setVisible((v) => !v)}
        >
          <span className="material-symbols-outlined">{visible ? 'visibility' : 'visibility_off'}</span>
        </button>
      </div>
    </>
  );
}
