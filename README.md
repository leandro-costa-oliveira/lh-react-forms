# lh-react-forms

A small form hook library inspired by `react-hook-form`, but using a controlled-components approach by default.

Instead of relying on uncontrolled inputs and DOM refs, `lh-react-forms` keeps form state in React and returns ready-to-use props for controlled components.

## Key features

- Simple `useForm` API.
- Controlled fields (`value` + `onChange`) by default.
- Per-field validation (`required`, `validate`, `validateOnChange`).
- Form state (`isSubmitting`, `errors`).
- Built-in `localStorage` persistence using `persistName`.

## Installation

```bash
npm install lh-react-forms
```

If you use TypeScript with React:

```bash
npm install -D @types/react
```

## Basic usage

```tsx
import React from "react";
import { useForm } from "lh-react-forms";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    initialData: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    console.log("submitting", data);
    // await api.post("/login", data)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        {...register("email", {
          required: true,
          validate: (value) => value.includes("@") || "Invalid email",
        })}
      />
      {errors.email && <small>{errors.email.message}</small>}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        {...register("password", {
          required: true,
          validate: (value) => value.length >= 6 || "Minimum 6 characters",
        })}
      />
      {errors.password && <small>{errors.password.message}</small>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

## Automatic persistence with localStorage

Pass `persistName` to automatically save and restore form data:

```tsx
const form = useForm<{ name: string; phone: string }>({
  initialData: { name: "", phone: "" },
  persistName: "customer-signup",
});
```

Behavior:

- On mount the hook tries to load `localStorage.getItem("customer-signup")` and restore it into the form state.
- Every time `formData` changes, it is saved to `localStorage`.

## Example with a custom controlled component

The `onChange` from `register` accepts either:

- a native input event (it will read `event.target.value`), or
- a direct value (handy for custom components).

```tsx
import React from "react";
import { useForm } from "lh-react-forms";

type ProfileForm = {
  name: string;
  age: number;
};

type NumberInputProps = {
  value: number | "";
  onChange: (value: number) => void;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
  disabled?: boolean;
};

function NumberInput({ value, onChange, onBlur, disabled }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onBlur}
      disabled={disabled}
    />
  );
}

export function ProfilePage() {
  const { register, handleSubmit } = useForm<ProfileForm>({
    initialData: { name: "", age: 0 },
    persistName: "profile-form",
  });

  const ageField = register("age", {
    validate: (value) => value >= 18 || "Minimum age: 18",
    validateOnChange: true,
  });

  return (
    <form onSubmit={handleSubmit(async (data) => console.log(data))}>
      <input placeholder="Name" {...register("name", { required: true })} />

      <NumberInput
        value={ageField.value}
        onChange={ageField.onChange}
        onBlur={ageField.onBlur as React.FocusEventHandler<HTMLInputElement>}
        disabled={ageField.disabled}
      />

      <button type="submit">Save</button>
    </form>
  );
}
```

## Complex example — AnexosInput

Below is a real-world example of a controlled component (`AnexosInput`) that receives `value`, `onChange` and other form props and manages file attachments (base64 content).

```tsx
import { useMemo, useRef, useState } from "react";
import { Button, Form, ListGroup, Spinner } from "react-bootstrap";

import { FaTrash } from "react-icons/fa";
import type { AdicionarObservacaoAnexo } from "../api/useAdicionarObservacao";
import { useTiposAnexosOs } from "../api/useTiposAnexosOs";

export default function AnexosInput({ disabled, value, onChange, errorFeedback, isInvalid }: Props) {
  const { data: tiposAnexos, isLoading: loadingTipos } = useTiposAnexosOs();
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const anexos = useMemo(() => {
    return typeof value === "string" ? [] : value || [];
  }, [value]);

  async function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const converted = await Promise.all(
      selected.map(async (file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        content: await fileToBase64(file),
        TipoAnexoOsId: tipoSelecionado,
      })),
    );

    onChange?.([...anexos, ...converted]);
    setTipoSelecionado("");
  }

  function handleRemove(index: number) {
    onChange?.(anexos.filter((_, i) => i !== index));
  }

  const tipoLabel = (id: string) => tiposAnexos?.find((t) => t.id === id)?.tipo ?? id;

  return (
    <Form.Group controlId="anexos" className="mt-3">
      <Form.Label className="fw-semibold mb-1">Anexos</Form.Label>
      <Form.Label className="small text-muted mb-1">Tipo do anexo</Form.Label>
      {loadingTipos ? (
        <div className="d-flex align-items-center gap-2 mb-2">
          <Spinner size="sm" />
          <span className="small text-muted">Carregando tipos...</span>
        </div>
      ) : (
        <>
          <Form.Select
            value={tipoSelecionado}
            onChange={(e) => {
              setTipoSelecionado(e.target.value);
              fileInputRef.current?.click();
            }}
            disabled={disabled}
            size="sm"
            className="mb-2"
          >
            <option value="">Selecione o tipo para adicionar arquivo</option>
            {tiposAnexos?.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.tipo}
              </option>
            ))}
          </Form.Select>

          <div className="d-grid gap-1">
            <Button
              type="button"
              variant="outline-primary"
              disabled={disabled || !tipoSelecionado}
              onClick={() => fileInputRef.current?.click()}
            >
              Abrir câmera
            </Button>
          </div>
        </>
      )}
      <Form.Control
        ref={fileInputRef}
        type="file"
        multiple
        isInvalid={isInvalid}
        onChange={handleSelect}
        disabled={disabled}
        accept="image/*"
        capture="environment"
        className="visually-hidden"
      />
      {anexos.length > 0 && (
        <ListGroup className="mt-2">
          {anexos.map((anexo, index) => (
            <ListGroup.Item key={`${anexo.name}-${anexo.type}-${index}`} className="d-flex align-items-center gap-2">
              <div className="flex-grow-1 text-truncate">
                <span className="text-muted me-2 small">{tipoLabel(anexo.TipoAnexoOsId)}</span>
                <span className="fw-semibold">{anexo.name}</span>
              </div>
              <Button
                type="button"
                variant="outline-danger"
                size="sm"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <FaTrash />
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {errorFeedback && <Form.Control.Feedback type="invalid">{errorFeedback}</Form.Control.Feedback>}
    </Form.Group>
  );
}

type Props = Pick<React.ComponentProps<typeof Form.Control>, "onBlur" | "disabled"> & {
  onChange?: (value: AdicionarObservacaoAnexo[]) => void;
  value?: AdicionarObservacaoAnexo[] | "";
  errorFeedback?: string;
  isInvalid?: boolean;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const content = result.includes(",") ? result.split(",")[1] : result;
      resolve(content);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

### Usage

Here's a minimal example showing how to register and use `AnexosInput` with `useForm`:

```tsx
import React from "react";
import AnexosInput from "./AnexosInput"; // adjust path
import { useForm } from "lh-react-forms";

type FormData = { anexos: any[] | "" };

export function ObservacoesPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ initialData: { anexos: "" } });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <AnexosInput
        {...register("anexos", {
          validateOnChange: true,
          required: "Selecione pelo menos um anexo.",
          validate: (value) => (Array.isArray(value) && value.length > 0) || "Selecione pelo menos um anexo.",
        })}
        errorFeedback={errors.anexos?.message}
        isInvalid={!!errors.anexos}
      />

      <button type="submit">Enviar</button>
    </form>
  );
}
```

## API summary

### `useForm<T>(options?)`

```ts
type UseFormOptions<T> = {
  initialData?: T;
  persistName?: string;
};
```

Returns:

- `register(field, options?)`
- `handleSubmit(onSubmit)`
- `setValue(field, value)`
- `setError(field, error)`
- `clearError(field)`
- `watch(field)`
- `getValues()` / `getValues(field)`
- `validateForm()`
- `formData`
- `formState: { isSubmitting, errors }`

### `register` options

```ts
type RegisterOptions<TValue> = {
  required?: boolean | string;
  validate?: (value: TValue) => boolean | string | Promise<boolean | string>;
  validateOnChange?: boolean;
};
```

## Notes

- `required` currently uses the default message: `Este campo é obrigatório.` (Portuguese). You may override validation messages via `validate` or by calling `setError`.
- Submission errors appear under `formState.errors.submitError`.
- To manually clear persisted data call `localStorage.removeItem(persistName)`.

## License

ISC

```

```
