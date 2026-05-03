import { useCallback, useEffect, useRef, useState } from "react";

export function useForm<T>(options: { initialData?: T; persistName?: string } = {}) {
  const { initialData, persistName } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof T, FormError>> & Record<string, FormError>>({});
  const [formData, setFormData] = useState<T>(initialData || ({} as T));
  const fieldsRef = useRef<RegisterOptionsMap<T>>({});
  const loadCacheRef = useRef(false);

  useEffect(() => {
    if (!persistName || loadCacheRef.current) {
      loadCacheRef.current = true;
      return;
    }

    try {
      const cachedData = localStorage.getItem(persistName);
      const jsonData = cachedData ? JSON.parse(cachedData) : null;
      if (jsonData) setFormData(jsonData as T);

      // console.log("Loaded form data from localStorage:", persistName, jsonData);
      loadCacheRef.current = true;
    } catch (error) {
      console.error("Failed to load form data from localStorage:", {
        persistName,
        error,
      });
    }
  }, [persistName]);

  useEffect(() => {
    if (!persistName || !loadCacheRef.current) return;

    try {
      // console.log("Saving form data to localStorage:", persistName, formData);
      localStorage.setItem(persistName, JSON.stringify(formData));
    } catch (error) {
      console.error("Failed to save form data to localStorage:", {
        persistName,
        formData,
        error,
      });
    }
  }, [formData, persistName]);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => {
      if (Object.is(prev[field], value)) {
        return prev;
      }

      return { ...prev, [field]: value };
    });
  }, []);

  const setError = (field: keyof T | string, error: FormError | string) => {
    setErrors((prev) => {
      return { ...prev, [field]: typeof error === "string" ? { message: error } : error };
    });
  };

  const clearError = useCallback((field: keyof T | string) => {
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      if (field === "root") {
        delete newErrors.root;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  }, []);

  const watch = <K extends keyof T>(field: K) => {
    return formData[field];
  };

  function register<K extends BooleanKeys<T>>(field: K, options?: REGISTER_OPTIONS<T[K]>): RegisteredBooleanFieldProps;
  function register<K extends NonBooleanKeys<T>>(
    field: K,
    options?: REGISTER_OPTIONS<T[K]>,
  ): RegisteredNonBooleanFieldProps<T[K]>;
  function register<K extends keyof T>(
    field: K,
    options?: REGISTER_OPTIONS<T[K]>,
  ): RegisteredBooleanFieldProps | RegisteredNonBooleanFieldProps<T[K]> {
    fieldsRef.current[field] = options || {};

    const commonProps = {
      name: String(field),
      disabled: isSubmitting,
      required: !!options?.required,
      isInvalid: !!errors[field] as true | false,
      onBlur: (_e: React.FocusEvent<FormControlElement | HTMLLabelElement>) => {
        validateField(field);
      },
    };

    if (typeof formData[field] === "boolean") {
      return {
        ...commonProps,
        checked: !!formData[field],
        onChange: async (e: React.ChangeEvent<HTMLInputElement>) => {
          setValue(field, e.target.checked as T[K]);
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (options?.validateOnChange) {
            validateField(field, e.target.checked as T[K]);
          }
        },
      };
    }

    return {
      ...commonProps,
      value: normalizeFieldValue(formData[field]),
      onChange: async (valueOrEvent: RegisterOnChangeArg<T[K]>) => {
        if (isFormControlChangeEvent(valueOrEvent)) {
          setValue(field, valueOrEvent.target.value as T[K]);
          return;
        }

        setValue(field, valueOrEvent);
        await new Promise((resolve) => setTimeout(resolve, 0)); // Aguarda o estado atualizar antes de validar
        if (options?.validateOnChange) {
          validateField(field, valueOrEvent);
        }
      },
    };
  }

  const validateField = async <K extends keyof T>(field: K, data?: T[K]): Promise<boolean> => {
    const rules = fieldsRef.current[field];
    const value = data ?? formData[field];

    const fail = (msg: string) => {
      setErrors((prevErrors) => ({ ...prevErrors, [field]: new Error(msg) }));
    };

    if (rules?.required && !value && value !== 0 && value !== false) {
      fail(resolveMessage(rules.required, ERROR_MESSAGES.required));
      return false;
    }

    if (rules?.minLength !== undefined && typeof value === "string") {
      const { value: min, message } = normalizeConstraint(rules.minLength);
      if (value.length < min) {
        fail(message ?? ERROR_MESSAGES.minLength(min));
        return false;
      }
    }

    if (rules?.maxLength !== undefined && typeof value === "string") {
      const { value: max, message } = normalizeConstraint(rules.maxLength);
      if (value.length > max) {
        fail(message ?? ERROR_MESSAGES.maxLength(max));
        return false;
      }
    }

    if (rules?.min !== undefined && typeof value === "number") {
      const { value: min, message } = normalizeConstraint(rules.min);
      if (value < min) {
        fail(message ?? ERROR_MESSAGES.min(min));
        return false;
      }
    }

    if (rules?.max !== undefined && typeof value === "number") {
      const { value: max, message } = normalizeConstraint(rules.max);
      if (value > max) {
        fail(message ?? ERROR_MESSAGES.max(max));
        return false;
      }
    }

    if (rules?.pattern !== undefined && typeof value === "string") {
      const { value: regex, message } = normalizePatternConstraint(rules.pattern);
      if (!regex.test(value)) {
        fail(message ?? ERROR_MESSAGES.pattern);
        return false;
      }
    }

    if (rules?.validate) {
      const validationResult = await rules.validate(value);
      if (validationResult !== true) {
        fail(validationResult as string);
        return false;
      }
    }

    clearError(field);
    return true;
  };

  const validateForm = async (): Promise<boolean> => {
    let errorCount = 0;
    for (const field in fieldsRef.current) {
      if (!(await validateField(field))) {
        errorCount++;
      }
    }

    return errorCount === 0;
  };

  const handleSubmit = (onSubmit: (data: T) => Promise<void>) => async (e?: React.SubmitEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const formValid = await validateForm();
    if (!formValid) {
      console.log("Form Invalid", formValid, errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const ret = await onSubmit(formData);

      if (persistName && ret) localStorage.removeItem(persistName);
    } catch (error) {
      console.error("Form submission error:", error);
      setErrors((prevErrors) => ({
        ...prevErrors,
        submitError: parseError(error),
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  function getValues(): T;
  function getValues<K extends keyof T>(fieldName: K): T[K];
  function getValues<K extends keyof T>(fieldName?: K) {
    if (fieldName !== undefined) {
      return formData[fieldName];
    }

    return formData;
  }

  return {
    watch,
    formData,
    register,
    setValue,
    setError,
    handleSubmit,
    clearError,
    getValues,
    validateForm,
    formState: { isSubmitting, errors },
  };
}

type FormError = {
  message: string;
};

type ValidationConstraint<TValue> = TValue | { value: TValue; message?: string };

type REGISTER_OPTIONS<TValue> = {
  required?: boolean | string;
  minLength?: ValidationConstraint<number>;
  maxLength?: ValidationConstraint<number>;
  min?: ValidationConstraint<number>;
  max?: ValidationConstraint<number>;
  pattern?: ValidationConstraint<RegExp>;
  validate?: (value: TValue) => boolean | string | Promise<boolean | string>;
  validateOnChange?: boolean;
};

type RegisterOptionsMap<T> = Partial<{
  [K in keyof T]: REGISTER_OPTIONS<T[K]>;
}>;

type FormControlElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type RegisterOnChangeArg<TValue> = TValue | React.ChangeEvent<FormControlElement>;
type RegisterValue<TValue> = Exclude<TValue, null | undefined> | "";

type BooleanKeys<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];
type NonBooleanKeys<T> = { [K in keyof T]: T[K] extends boolean ? never : K }[keyof T];

type RegisteredBooleanFieldProps = {
  name: string;
  checked: boolean;
  disabled: boolean;
  required: boolean;
  isInvalid: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onBlur: (e: React.FocusEvent<FormControlElement | HTMLLabelElement>) => void;
};

type RegisteredNonBooleanFieldProps<TValue> = {
  name: string;
  value: RegisterValue<TValue>;
  disabled: boolean;
  required: boolean;
  isInvalid: boolean;
  onChange: (valueOrEvent: RegisterOnChangeArg<TValue>) => Promise<void>;
  onBlur: (e: React.FocusEvent<FormControlElement | HTMLLabelElement>) => void;
};

type RegisteredFieldProps<TValue> = TValue extends boolean
  ? RegisteredBooleanFieldProps
  : RegisteredNonBooleanFieldProps<TValue>;

const ERROR_MESSAGES = {
  required: "Este campo é obrigatório.",
  minLength: (min: number) => `Mínimo de ${min} caracteres.`,
  maxLength: (max: number) => `Máximo de ${max} caracteres.`,
  min: (min: number) => `O valor deve ser no mínimo ${min}.`,
  max: (max: number) => `O valor deve ser no máximo ${max}.`,
  pattern: "Formato inválido.",
};

function resolveMessage(rule: boolean | string, fallback: string): string {
  return typeof rule === "string" ? rule : fallback;
}

function normalizeConstraint<TValue>(constraint: ValidationConstraint<TValue>): { value: TValue; message?: string } {
  if (constraint !== null && typeof constraint === "object" && "value" in (constraint as object)) {
    return constraint as { value: TValue; message?: string };
  }
  return { value: constraint as TValue };
}

function normalizePatternConstraint(constraint: ValidationConstraint<RegExp>): { value: RegExp; message?: string } {
  if (constraint instanceof RegExp) {
    return { value: constraint };
  }
  return constraint as { value: RegExp; message?: string };
}

function normalizeFieldValue<TValue>(value: TValue): RegisterValue<TValue> {
  return (value ?? "") as RegisterValue<TValue>;
}

function isFormControlChangeEvent(value: unknown): value is React.ChangeEvent<FormControlElement> {
  return typeof value === "object" && value !== null && "target" in value;
}

function isAxiosError(error: unknown): error is { response?: { data?: any } } {
  return typeof error === "object" && error !== null && "response" in error;
}

function parseError(error: unknown): FormError {
  return isAxiosError(error)
    ? { message: error.response?.data?.mensagem || error.response?.data || `Erro Desconhecido ${error}` }
    : error instanceof Error
      ? { message: error.message }
      : { message: `Erro Desconhecido ${String(error)}` };
}
