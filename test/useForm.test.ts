import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { useForm } from "../src/useForm";

type TestForm = {
  name: string;
  age: number;
  anexos: string[] | "";
};

let formApi: ReturnType<typeof useForm<TestForm>>;

function TestHarness({ initialData, persistName }: { initialData?: TestForm; persistName?: string }) {
  formApi = useForm<TestForm>({ initialData, persistName });
  return null;
}

function renderForm(options?: { initialData?: TestForm; persistName?: string }) {
  return render(React.createElement(TestHarness, options));
}

describe("useForm", () => {
  it("initializes with the provided data and exposes controlled field props", () => {
    renderForm({
      initialData: {
        name: "Maria",
        age: 30,
        anexos: "",
      },
    });

    const nameField = formApi.register("name");

    expect(formApi.getValues()).toEqual({ name: "Maria", age: 30, anexos: "" });
    expect(formApi.watch("name")).toBe("Maria");
    expect(nameField).toMatchObject({
      name: "name",
      value: "Maria",
      disabled: false,
      required: false,
      isInvalid: false,
    });
  });

  it("updates values from both change events and direct values", async () => {
    renderForm({
      initialData: {
        name: "",
        age: 0,
        anexos: "",
      },
    });

    await act(async () => {
      await formApi.register("name").onChange({ target: { value: "João" } } as React.ChangeEvent<HTMLInputElement>);
      await formApi.register("age").onChange(42);
    });

    await waitFor(() => {
      expect(formApi.getValues("name")).toBe("João");
      expect(formApi.getValues("age")).toBe(42);
    });
  });

  it("validates required fields on blur", async () => {
    renderForm({
      initialData: {
        name: "",
        age: 0,
        anexos: "",
      },
    });

    await act(async () => {
      formApi.register("name", { required: true }).onBlur({} as React.FocusEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(formApi.formState.errors.name?.message).toBe("Este campo é obrigatório.");
    });
  });

  it("runs `validateOnChange` for array-based custom components like `AnexosInput`", async () => {
    renderForm({
      initialData: {
        name: "",
        age: 0,
        anexos: "",
      },
    });

    const anexosField = formApi.register("anexos", {
      validateOnChange: true,
      required: "Selecione pelo menos um anexo.",
      validate: (value) => (Array.isArray(value) && value.length > 0) || "Selecione pelo menos um anexo.",
    });

    await act(async () => {
      await anexosField.onChange([]);
    });

    await waitFor(() => {
      expect(formApi.formState.errors.anexos?.message).toBe("Selecione pelo menos um anexo.");
    });

    await act(async () => {
      await anexosField.onChange(["foto.png"]);
    });

    await waitFor(() => {
      expect(formApi.formState.errors.anexos).toBeUndefined();
      expect(formApi.getValues("anexos")).toEqual(["foto.png"]);
    });
  });

  it("prevents invalid submit and calls the submit handler when the form is valid", async () => {
    renderForm({
      initialData: {
        name: "",
        age: 0,
        anexos: "",
      },
    });

    formApi.register("name", { required: true });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;

    await act(async () => {
      await formApi.handleSubmit(onSubmit)(event as React.SubmitEvent);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await formApi.register("name").onChange("Leandro");
    });

    await waitFor(() => {
      expect(formApi.getValues("name")).toBe("Leandro");
    });

    await act(async () => {
      await formApi.handleSubmit(onSubmit)(event as React.SubmitEvent);
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Leandro",
        age: 0,
        anexos: "",
      });
    });
  });

  it("loads persisted data, saves updates, and stores submit errors", async () => {
    localStorage.setItem(
      "customer-form",
      JSON.stringify({
        name: "Cache",
        age: 18,
        anexos: ["doc.pdf"],
      }),
    );

    renderForm({
      initialData: {
        name: "",
        age: 0,
        anexos: "",
      },
      persistName: "customer-form",
    });

    await waitFor(() => {
      expect(formApi.getValues()).toEqual({
        name: "Cache",
        age: 18,
        anexos: ["doc.pdf"],
      });
    });

    await act(async () => {
      await formApi.register("name").onChange("Atualizado");
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("customer-form") || "null")).toEqual({
        name: "Atualizado",
        age: 18,
        anexos: ["doc.pdf"],
      });
    });

    formApi.register("name");

    await act(async () => {
      await formApi.handleSubmit(async () => {
        throw new Error("Falha ao enviar");
      })();
    });

    await waitFor(() => {
      expect(formApi.formState.errors.submitError?.message).toBe("Falha ao enviar");
    });
  });
});
