````markdown
# lh-forms

A small form hook library inspired by `react-hook-form`, but using a controlled-components approach by default.

Instead of relying on uncontrolled inputs and DOM refs, `lh-forms` keeps form state in React and returns ready-to-use props for controlled components.

## Key features

- Simple `useForm` API.
- Controlled fields (`value` + `onChange`) by default.
- Per-field validation (`required`, `validate`, `validateOnChange`).
- Form state (`isSubmitting`, `errors`).
- Built-in `localStorage` persistence using `persistName`.

## Installation

```bash
npm install lh-forms
```

If you use TypeScript with React:

```bash
npm install -D @types/react
```

## Basic usage

```tsx
import React from "react";
import { useForm } from "lh-forms";

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
import { useForm } from "lh-forms";

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

## Complex example — array fields (MaterialSelector)

Below is a real-world example of a controlled component that manages an array of selected items. The component receives a `value` (array or empty string), `onChange` and `onBlur` props from `register` and updates the parent form using the provided `onChange` callback.

```tsx
// MaterialSelector.tsx
import { useMemo, useState } from "react";
import { Button, Form, Table } from "react-bootstrap";
import { FaTrash } from "react-icons/fa";

export type MaterialOption = {
  id: string;
  nome: string;
  saldo?: number;
};

export type SelectedMaterial = {
  id: string;
  nome: string;
  quantidade: number;
};

type Props = {
  title: string;
  options: MaterialOption[];
  value?: SelectedMaterial[] | "";
  disabled?: boolean;
  onChange?: (value: SelectedMaterial[]) => void;
  onBlur?: React.FocusEventHandler<HTMLSelectElement | HTMLInputElement>;
  emptyMessage?: string;
};

export default function MaterialSelector({
  title,
  options,
  value,
  disabled,
  onChange,
  onBlur,
  emptyMessage = "Nenhum material adicionado.",
}: Props) {
  const [selectedId, setSelectedId] = useState("");
  const selectedItems = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const availableOptions = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((item) => item.id));
    return options.filter((item) => !selectedIds.has(item.id));
  }, [options, selectedItems]);

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setSelectedId(id);

    const item = availableOptions.find((option) => option.id === id) ?? null;

    if (!item) return;

    onChange?.([
      ...selectedItems,
      {
        id: item.id,
        nome: item.nome,
        quantidade: 1,
      },
    ]);

    setSelectedId("");
  }

  function handleUpdateQuantidade(id: string, quantidade: number) {
    onChange?.(selectedItems.map((item) => (item.id === id ? { ...item, quantidade } : item)));
  }

  function handleRemoveItem(id: string) {
    onChange?.(selectedItems.filter((item) => item.id !== id));
  }

  return (
    <div className="mt-4">
      <Form.Label className="fw-semibold mb-2">{title}</Form.Label>

      <div className="d-flex gap-2 flex-column flex-sm-row align-items-stretch align-items-sm-end">
        <Form.Group className="flex-grow-1 mb-0">
          <Form.Label className="small text-muted mb-1">Selecionar material</Form.Label>
          <Form.Select
            value={selectedId}
            onChange={handleSelectChange}
            onBlur={onBlur}
            disabled={disabled || availableOptions.length === 0}
          >
            <option value="">Selecione...</option>
            {availableOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
                {typeof item.saldo === "number" ? ` (Saldo: ${item.saldo})` : ""}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>

      <Table striped hover responsive className="mt-2 mb-0">
        <thead>
          <tr>
            <th>Produto</th>
            <th className="text-nowrap">Quantidade</th>
            <th className="text-end">Ações</th>
          </tr>
        </thead>
        <tbody>
          {selectedItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-muted py-3">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            selectedItems.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>
                  <Form.Control
                    type="number"
                    style={{ width: "80px" }}
                    min={1}
                    step={1}
                    size="sm"
                    value={item.quantidade}
                    disabled={disabled}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      const quantidade = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                      handleUpdateQuantidade(item.id, quantidade);
                    }}
                  />
                </td>
                <td className="text-end">
                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remover"
                    aria-label="Remover"
                  >
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

Usage with `useForm`:

```tsx
type FormData = {
  materialUtilizado: { id: string; nome: string; quantidade: number }[];
};

const { register, handleSubmit } = useForm<FormData>({
  initialData: { materialUtilizado: [] },
});

return (
  <form onSubmit={handleSubmit(async (data) => console.log(data))}>
    <MaterialSelector
      title="Material Utilizado"
      options={materialsInStock}
      {...register("materialUtilizado")}
      emptyMessage="Nenhum material utilizado adicionado."
    />

    <button type="submit">Submit</button>
  </form>
);
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
````
