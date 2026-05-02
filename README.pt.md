# lh-react-forms (pt-BR)

Uma pequena biblioteca de hooks de formulário inspirada em [react-hook-form](https://react-hook-form.com/), porém usando componentes controlados por padrão.

Ao invés de depender de inputs não-controlados e refs no DOM, `lh-react-forms` mantém o estado do formulário no React e retorna props prontas para componentes controlados.

## Principais características

- API simples com `useForm`.
- Campos controlados (`value` + `onChange`) por padrão.
- Validação por campo (`required`, `validate`, `validateOnChange`).
- Estado do formulário (`isSubmitting`, `errors`).
- Persistência automática em `localStorage` via `persistName`.

## Instalação

```bash
npm install lh-react-forms
```

Se usar TypeScript com React:

```bash
npm install -D @types/react
```

## Uso básico

Veja o `README.md` principal para exemplos simples. Abaixo há um exemplo complexo com campos do tipo array.

## Exemplo complexo — AnexosInput

A seguir um exemplo real de componente controlado (`AnexosInput`) que recebe `value`, `onChange` e outras props de formulário e gerencia anexos como conteúdo base64.

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

### Exemplo de uso

Abaixo um exemplo mínimo mostrando como registrar e usar o `AnexosInput` com `useForm`:

```tsx
import React from "react";
import AnexosInput from "./AnexosInput"; // ajuste o caminho conforme seu projeto
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
