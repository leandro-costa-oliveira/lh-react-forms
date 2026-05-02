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
