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

  it("handles boolean checkbox fields with checked prop and ChangeEvent onChange", async () => {
    type CheckboxForm = { remember: boolean };
    let checkboxApi: ReturnType<typeof useForm<CheckboxForm>>;

    function CheckboxHarness() {
      checkboxApi = useForm<CheckboxForm>({ initialData: { remember: false } });
      return null;
    }

    render(React.createElement(CheckboxHarness));

    const field = checkboxApi!.register("remember");

    // Must expose `checked`, not `value`
    expect(field).toHaveProperty("checked", false);
    expect(field).not.toHaveProperty("value");

    // Simulate a checkbox change event
    await act(async () => {
      await field.onChange({ target: { checked: true } } as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(checkboxApi.getValues("remember")).toBe(true);
      expect(checkboxApi.register("remember").checked).toBe(true);
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

  describe("built-in validation rules", () => {
    type ValidationForm = {
      username: string;
      password: string;
      bio: string;
      age: number;
      score: number;
      email: string;
    };

    let api: ReturnType<typeof useForm<ValidationForm>>;

    function ValidationHarness() {
      api = useForm<ValidationForm>({
        initialData: { username: "", password: "", bio: "", age: 0, score: 0, email: "" },
      });
      return null;
    }

    function renderValidation() {
      render(React.createElement(ValidationHarness));
    }

    it("minLength — rejects short value with default message", async () => {
      renderValidation();
      api.register("password", { minLength: 8 });

      await act(async () => {
        await api.setValue("password", "abc");
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password?.message).toBe("Mínimo de 8 caracteres.");
      });
    });

    it("minLength — rejects short value with custom message", async () => {
      renderValidation();
      api.register("password", {
        minLength: { value: 8, message: "A senha deve ter ao menos 8 caracteres." },
      });

      await act(async () => {
        await api.setValue("password", "abc");
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password?.message).toBe("A senha deve ter ao menos 8 caracteres.");
      });
    });

    it("minLength — passes when value is long enough", async () => {
      renderValidation();
      api.register("password", { minLength: 8 });

      await act(async () => {
        api.setValue("password", "strongpass");
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password).toBeUndefined();
      });
    });

    it("maxLength — rejects long value with default message", async () => {
      renderValidation();
      api.register("bio", { maxLength: 10 });

      await act(async () => {
        api.setValue("bio", "This text is way too long");
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.bio?.message).toBe("Máximo de 10 caracteres.");
      });
    });

    it("maxLength — passes when value is within limit", async () => {
      renderValidation();
      api.register("bio", { maxLength: 10 });

      await act(async () => {
        await api.setValue("bio", "short");
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.bio).toBeUndefined();
      });
    });

    it("min — rejects value below minimum", async () => {
      renderValidation();
      api.register("age", { min: 18 });

      await act(async () => {
        await api.setValue("age", 16);
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.age?.message).toBe("O valor deve ser no mínimo 18.");
      });
    });

    it("min — passes when value meets minimum", async () => {
      renderValidation();
      api.register("age", { min: 18 });

      await act(async () => {
        api.setValue("age", 18);
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.age).toBeUndefined();
      });
    });

    it("max — rejects value above maximum", async () => {
      renderValidation();
      api.register("score", { max: { value: 100, message: "Pontuação não pode ultrapassar 100." } });

      await act(async () => {
        api.setValue("score", 150);
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.score?.message).toBe("Pontuação não pode ultrapassar 100.");
      });
    });

    it("max — passes when value is within maximum", async () => {
      renderValidation();
      api.register("score", { max: 100 });

      await act(async () => {
        await api.setValue("score", 100);
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.score).toBeUndefined();
      });
    });

    it("pattern — rejects value not matching regex", async () => {
      renderValidation();
      api.register("email", {
        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "E-mail inválido." },
      });

      await act(async () => {
        await api.setValue("email", "not-an-email");
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.email?.message).toBe("E-mail inválido.");
      });
    });

    it("pattern — passes when value matches regex", async () => {
      renderValidation();
      api.register("email", {
        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "E-mail inválido." },
      });

      await act(async () => {
        api.setValue("email", "user@example.com");
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.email).toBeUndefined();
      });
    });

    it("required with custom message shows that message", async () => {
      renderValidation();
      api.register("username", { required: "Nome de usuário é obrigatório." });

      await act(async () => {
        await api.setValue("username", "");
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.username?.message).toBe("Nome de usuário é obrigatório.");
      });
    });

    it("rules are applied in order: required before minLength", async () => {
      renderValidation();
      api.register("password", {
        required: "Informe sua senha.",
        minLength: { value: 8, message: "A senha deve ter ao menos 8 caracteres." },
      });

      // initial value is already "", so no need to setValue first
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password?.message).toBe("Informe sua senha.");
      });

      await act(async () => {
        api.setValue("password", "abc");
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password?.message).toBe("A senha deve ter ao menos 8 caracteres.");
      });

      await act(async () => {
        api.setValue("password", "strongpassword");
      });
      await act(async () => {
        await api.validateForm();
      });

      await waitFor(() => {
        expect(api.formState.errors.password).toBeUndefined();
      });
    });
  });
});
