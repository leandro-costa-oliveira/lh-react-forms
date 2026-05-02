# lh-forms (pt-BR)

Uma pequena biblioteca de hooks de formulário inspirada em `react-hook-form`, porém usando componentes controlados por padrão.

Ao invés de depender de inputs não-controlados e refs no DOM, `lh-forms` mantém o estado do formulário no React e retorna props prontas para componentes controlados.

## Principais características

- API simples com `useForm`.
- Campos controlados (`value` + `onChange`) por padrão.
- Validação por campo (`required`, `validate`, `validateOnChange`).
- Estado do formulário (`isSubmitting`, `errors`).
- Persistência automática em `localStorage` via `persistName`.

## Instalação

```bash
npm install lh-forms
```

Se usar TypeScript com React:

```bash
npm install -D @types/react
```

## Uso básico

Veja o `README.md` principal para exemplos simples. Abaixo há um exemplo complexo com campos do tipo array.

## Exemplo complexo — campos em array (MaterialSelector)

A seguir um exemplo real de componente controlado que gerencia um array de itens selecionados. O componente recebe `value` (array ou string vazia), `onChange` e `onBlur` vindos de `register` e atualiza o formulário pai via `onChange`.

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

Uso com `useForm`:

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
      options={materiaisEstoque}
      {...register("materialUtilizado")}
      emptyMessage="Nenhum material utilizado adicionado."
    />

    <button type="submit">Enviar</button>
  </form>
);
```

---

Se quiser, posso também:

- traduzir todo o `README.md` principal para pt-BR e manter ambos arquivos sincronizados, ou
- manter apenas `README.md` em inglês e `README.pt.md` em português (atual configuração).

Diga como prefere que eu prossiga.
