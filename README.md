# lh-forms

Uma lib de formulários inspirada no `react-hook-form`, mas com abordagem **controlada** por padrão.

Em vez de trabalhar com inputs não-controlados e refs no DOM, o `lh-forms` mantém o estado no React e retorna props prontas para componentes controlados.

## Principais características

- API simples com `useForm`.
- Campos controlados (`value` + `onChange`) por padrão.
- Validação por campo (`required`, `validate`, `validateOnChange`).
- Estado do formulário (`isSubmitting`, `errors`).
- Persistência em `localStorage` **out of the box** com `persistName`.

## Instalação

```bash
npm install lh-forms
```

> Se estiver usando TypeScript com React:

```bash
npm install -D @types/react
```

## Uso básico

```tsx
import React from "react";
import { useForm } from "lh-forms";

type LoginForm = {
  email: string;
  senha: string;
};

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    initialData: {
      email: "",
      senha: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    console.log("enviando", data);
    // await api.post("/login", data)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        {...register("email", {
          required: true,
          validate: (value) => value.includes("@") || "E-mail inválido",
        })}
      />
      {errors.email && <small>{errors.email.message}</small>}

      <label htmlFor="senha">Senha</label>
      <input
        id="senha"
        type="password"
        {...register("senha", {
          required: true,
          validate: (value) => value.length >= 6 || "Mínimo de 6 caracteres",
        })}
      />
      {errors.senha && <small>{errors.senha.message}</small>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
```

## Persistência automática com localStorage

Defina `persistName` para salvar e restaurar os dados automaticamente:

```tsx
const form = useForm<{ nome: string; telefone: string }>({
  initialData: { nome: "", telefone: "" },
  persistName: "cadastro-cliente",
});
```

Com isso:

- Ao montar, o hook tenta carregar `localStorage.getItem("cadastro-cliente")`.
- A cada mudança em `formData`, os dados são atualizados no `localStorage`.

## Exemplo com componente controlado customizado

A função `onChange` do `register` aceita:

- evento de input (`event.target.value`), ou
- valor direto (ótimo para componentes customizados).

```tsx
import React from "react";
import { useForm } from "lh-forms";

type ProfileForm = {
  nome: string;
  idade: number;
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
    initialData: { nome: "", idade: 0 },
    persistName: "profile-form",
  });

  const idadeField = register("idade", {
    validate: (value) => value >= 18 || "Idade mínima: 18",
    validateOnChange: true,
  });

  return (
    <form onSubmit={handleSubmit(async (data) => console.log(data))}>
      <input placeholder="Nome" {...register("nome", { required: true })} />

      <NumberInput
        value={idadeField.value}
        onChange={idadeField.onChange}
        onBlur={idadeField.onBlur as React.FocusEventHandler<HTMLInputElement>}
        disabled={idadeField.disabled}
      />

      <button type="submit">Salvar</button>
    </form>
  );
}
```

## API resumida

### `useForm<T>(options?)`

```ts
type UseFormOptions<T> = {
  initialData?: T;
  persistName?: string;
};
```

Retorna:

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

### Opções do `register`

```ts
type RegisterOptions<TValue> = {
  required?: boolean | string;
  validate?: (value: TValue) => boolean | string | Promise<boolean | string>;
  validateOnChange?: boolean;
};
```

## Observações

- `required` atualmente utiliza a mensagem padrão: `Este campo é obrigatório.`
- Erros de submissão são armazenados em `formState.errors.submitError`.
- Você pode limpar o cache manualmente com `localStorage.removeItem(persistName)` quando necessário.

## Licença

ISC
