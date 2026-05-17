import { useCallback, useEffect, useRef, useState } from "react";

export function useForm<T>(options: { initialData?: T; persistName?: string } = {}) {
  const { initialData, persistName } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [formData, setFormData] = useState<T>(initialData || ({} as T));
  const [isPersistenceReady, setIsPersistenceReady] = useState(!persistName);
  const fieldsRef = useRef<Partial<Record<string, REGISTER_OPTIONS<unknown>>>>({});
  const storageRef = useRef<PersistStorage | null>(null);
  const userEditedBeforeHydrationRef = useRef(false);

  const setRootMessage = useCallback((message: string) => {
    setErrors((prevErrors) => ({
      ...prevErrors,
      root: { message },
    }));
  }, []);

  const markUserEditBeforeHydration = useCallback(() => {
    if (persistName && !isPersistenceReady) {
      userEditedBeforeHydrationRef.current = true;
    }
  }, [isPersistenceReady, persistName]);

  useEffect(() => {
    userEditedBeforeHydrationRef.current = false;

    if (!persistName) {
      storageRef.current = null;
      setIsPersistenceReady(true);
      return;
    }

    setIsPersistenceReady(false);
    const storage = createPersistStorage(persistName, {
      onFallback: setRootMessage,
    });
    storageRef.current = storage;

    let cancelled = false;

    void (async () => {
      try {
        const cachedData = await storage.load<T>();
        if (!cancelled && !userEditedBeforeHydrationRef.current && cachedData) {
          setFormData(cachedData);
        }
      } catch (error) {
        console.error("Failed to load form data from persistent storage:", {
          persistName,
          error,
        });
        if (!cancelled) {
          setRootMessage(`Failed to load saved form data. ${error}`);
        }
      } finally {
        if (!cancelled) {
          setIsPersistenceReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistName, setRootMessage]);

  useEffect(() => {
    if (!persistName || !isPersistenceReady || !storageRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        await storageRef.current?.save(formData);
      } catch (error) {
        console.error("Failed to save form data to persistent storage:", {
          persistName,
          formData,
          error,
        });
        if (!cancelled) {
          setRootMessage(`Failed to save form data. ${error}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData, isPersistenceReady, persistName, setRootMessage]);

  const setValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      markUserEditBeforeHydration();
      setFormData((prev) => {
        if (Object.is(prev[field], value)) {
          return prev;
        }

        return { ...prev, [field]: value };
      });
    },
    [markUserEditBeforeHydration],
  );

  const setError = (field: keyof T | string, error: FormError | string) => {
    setErrors((prev) => {
      return setNestedValue(
        prev,
        String(field),
        typeof error === "string" ? { message: error } : error,
      ) as FormErrors<T>;
    });
  };

  const clearError = useCallback((field: keyof T | string) => {
    setErrors((prevErrors) => {
      return unsetNestedValue(prevErrors, String(field)) as FormErrors<T>;
    });
  }, []);

  const getFieldError = useCallback(
    (field: string): FormError | undefined => {
      const maybeError = getNestedValue<unknown>(errors, field);
      return isFormError(maybeError) ? maybeError : undefined;
    },
    [errors],
  );

  const watch = <K extends keyof T>(field: K) => {
    return formData[field];
  };

  function register<P extends BooleanFieldPaths<T>>(
    field: P,
    options?: REGISTER_OPTIONS<FieldPathValue<T, P>>,
  ): RegisteredBooleanFieldProps;
  function register<P extends NonBooleanFieldPaths<T>>(
    field: P,
    options?: REGISTER_OPTIONS<FieldPathValue<T, P>>,
  ): RegisteredNonBooleanFieldProps<FieldPathValue<T, P>>;
  function register<P extends FieldPath<T>>(
    field: P,
    options?: REGISTER_OPTIONS<FieldPathValue<T, P>>,
  ): RegisteredBooleanFieldProps | RegisteredNonBooleanFieldProps<FieldPathValue<T, P>> {
    fieldsRef.current[field] = options ?? {};

    const currentValue = getNestedValue<FieldPathValue<T, P>>(formData, field);

    const commonProps = {
      name: field,
      disabled: isSubmitting,
      required: !!options?.required,
      isInvalid: !!getFieldError(field) as true | false,
      onBlur: (_e: React.FocusEvent<FormControlElement | HTMLLabelElement>) => {
        validateField(field);
      },
    };

    if (typeof currentValue === "boolean") {
      return {
        ...commonProps,
        checked: currentValue,
        onChange: async (e: React.ChangeEvent<HTMLInputElement>) => {
          markUserEditBeforeHydration();
          setFormData((prev) => setNestedValue(prev, field, e.target.checked));
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (options?.validateOnChange) {
            validateField(field, e.target.checked);
          }
        },
      };
    }

    return {
      ...commonProps,
      value: normalizeFieldValue(currentValue),
      onChange: async (valueOrEvent: RegisterOnChangeArg<unknown>) => {
        markUserEditBeforeHydration();
        if (isFormControlChangeEvent(valueOrEvent)) {
          setFormData((prev) => setNestedValue(prev, field, valueOrEvent.target.value));
          return;
        }

        setFormData((prev) => setNestedValue(prev, field, valueOrEvent));
        await new Promise((resolve) => setTimeout(resolve, 0)); // Aguarda o estado atualizar antes de validar
        if (options?.validateOnChange) {
          validateField(field, valueOrEvent);
        }
      },
    };
  }

  const validateField = async (field: string, data?: unknown): Promise<boolean> => {
    const rules = fieldsRef.current[field];
    const value = data !== undefined ? data : getNestedValue(formData, field);

    const fail = (msg: string) => {
      setErrors((prevErrors) => setNestedValue(prevErrors, field, { message: msg }) as FormErrors<T>);
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

      if (persistName && ret) {
        await storageRef.current?.remove();
      }
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

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date | File;

type NestedFormErrors<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends Primitive | readonly unknown[]
    ? FormError
    : { message?: string } & NestedFormErrors<NonNullable<T[K]>>;
};

type FormErrors<T> = NestedFormErrors<T> & {
  root?: FormError;
  submitError?: FormError;
};

type ValidationConstraint<TValue> = TValue | { value: TValue; message?: string };

// Method syntax (`validate?()`) makes the parameter bivariant, so REGISTER_OPTIONS<SpecificType>
// is assignable to REGISTER_OPTIONS<unknown> — required for the fieldsRef store and overload compatibility.
interface REGISTER_OPTIONS<TValue> {
  required?: boolean | string;
  minLength?: ValidationConstraint<number>;
  maxLength?: ValidationConstraint<number>;
  min?: ValidationConstraint<number>;
  max?: ValidationConstraint<number>;
  pattern?: ValidationConstraint<RegExp>;
  validate?(value: TValue): boolean | string | Promise<boolean | string>;
  validateOnChange?: boolean;
}

// Generates all dot-notation paths for T (e.g. "company" | "company.name" | "name")
type FieldPath<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends string | number | boolean | Date | File | readonly unknown[]
    ? K
    : NonNullable<T[K]> extends object
      ? K | `${K}.${FieldPath<NonNullable<T[K]>>}`
      : K;
}[keyof T & string];

// Resolves the value type at a dot-notation path
type FieldPathValue<T, TPath extends string> = TPath extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? FieldPathValue<NonNullable<T[K]>, Rest>
    : never
  : TPath extends keyof T
    ? T[TPath]
    : never;

type BooleanFieldPaths<T> = {
  [P in FieldPath<T>]: FieldPathValue<T, P> extends boolean ? P : never;
}[FieldPath<T>];

type NonBooleanFieldPaths<T> = Exclude<FieldPath<T>, BooleanFieldPaths<T>>;

type FormControlElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type RegisterOnChangeArg<TValue> = TValue | React.ChangeEvent<FormControlElement>;
type RegisterValue<TValue> = Exclude<TValue, null | undefined> | "";

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

type PersistStorage = {
  load<T>(): Promise<T | null>;
  save(value: unknown): Promise<void>;
  remove(): Promise<void>;
};

type PersistBackend = "indexedDB" | "localStorage";

type PersistStorageOptions = {
  onFallback?: (message: string) => void;
};

const INDEXED_DB_NAME = "lh-react-forms";
const INDEXED_DB_STORE = "forms";

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

function getNestedValue<TValue>(obj: unknown, path: string): TValue {
  if (!path.includes(".")) {
    return (obj as Record<string, unknown>)?.[path] as TValue;
  }
  const dotIndex = path.indexOf(".");
  const key = path.slice(0, dotIndex);
  const rest = path.slice(dotIndex + 1);
  return getNestedValue<TValue>((obj as Record<string, unknown>)?.[key], rest);
}

function setNestedValue<TObj>(obj: TObj, path: string, value: unknown): TObj {
  const dotIndex = path.indexOf(".");
  if (dotIndex === -1) {
    return { ...(obj as object), [path]: value } as TObj;
  }
  const key = path.slice(0, dotIndex);
  const rest = path.slice(dotIndex + 1);
  const nested = (obj as Record<string, unknown>)?.[key] ?? {};
  return {
    ...(obj as object),
    [key]: setNestedValue(nested, rest, value),
  } as TObj;
}

function unsetNestedValue<TObj>(obj: TObj, path: string): TObj {
  const dotIndex = path.indexOf(".");

  if (dotIndex === -1) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    const clone = { ...(obj as Record<string, unknown>) };
    delete clone[path];
    return clone as TObj;
  }

  const key = path.slice(0, dotIndex);
  const rest = path.slice(dotIndex + 1);
  const source = obj as Record<string, unknown>;
  const current = source?.[key];

  if (current === null || typeof current !== "object") {
    return obj;
  }

  const next = unsetNestedValue(current, rest) as unknown;
  const clone = { ...source };

  if (isEmptyObject(next)) {
    delete clone[key];
  } else {
    clone[key] = next;
  }

  return clone as TObj;
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

function isFormError(value: unknown): value is FormError {
  return typeof value === "object" && value !== null && "message" in value;
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value).length === 0;
}

function parseError(error: unknown): FormError {
  return isAxiosError(error)
    ? { message: error.response?.data?.mensagem || error.response?.data || `Erro Desconhecido ${error}` }
    : error instanceof Error
      ? { message: error.message }
      : { message: `Erro Desconhecido ${String(error)}` };
}

function createPersistStorage(key: string, options: PersistStorageOptions = {}): PersistStorage {
  let activeBackend: PersistBackend | null = null;
  let backendPromise: Promise<PersistBackend> | null = null;
  let warnedFallback = false;
  let writeQueue = Promise.resolve();

  const warnFallback = (reason: unknown) => {
    if (warnedFallback) {
      return;
    }

    warnedFallback = true;
    options.onFallback?.(
      `IndexedDB indisponível para "${key}". Usando localStorage como fallback. ${stringifyError(reason)}`,
    );
  };

  const getBackend = async (): Promise<PersistBackend> => {
    if (activeBackend) {
      return activeBackend;
    }

    if (backendPromise) {
      return backendPromise;
    }

    backendPromise = (async () => {
      if (hasIndexedDb()) {
        try {
          const db = await openPersistDatabase();
          db.close();
          activeBackend = "indexedDB";
          return activeBackend;
        } catch (error) {
          if (hasLocalStorage()) {
            activeBackend = "localStorage";
            warnFallback(error);
            return activeBackend;
          }

          throw error;
        }
      }

      if (hasLocalStorage()) {
        activeBackend = "localStorage";
        warnFallback(new Error("IndexedDB não está disponível neste ambiente."));
        return activeBackend;
      }

      throw new Error("Nenhum mecanismo de persistência está disponível neste ambiente.");
    })();

    try {
      return await backendPromise;
    } finally {
      if (!activeBackend) {
        backendPromise = null;
      }
    }
  };

  const withFallback = async <T>(operation: (backend: PersistBackend) => Promise<T>): Promise<T> => {
    const backend = await getBackend();

    if (backend === "localStorage") {
      return operation(backend);
    }

    try {
      return await operation(backend);
    } catch (error) {
      if (!hasLocalStorage()) {
        throw error;
      }

      activeBackend = "localStorage";
      backendPromise = Promise.resolve(activeBackend);
      warnFallback(error);
      return operation(activeBackend);
    }
  };

  return {
    load: <T>() =>
      withFallback(async (backend) => {
        if (backend === "indexedDB") {
          return (await indexedDbGet<T>(key)) ?? null;
        }

        return localStorageGet<T>(key);
      }),
    save: (value: unknown) => {
      writeQueue = writeQueue.then(() =>
        withFallback(async (backend) => {
          if (backend === "indexedDB") {
            await indexedDbSet(key, value);
            return;
          }

          localStorageSet(key, value);
        }),
      );

      return writeQueue;
    },
    remove: () => {
      writeQueue = writeQueue.then(() =>
        withFallback(async (backend) => {
          if (backend === "indexedDB") {
            await indexedDbRemove(key);
            return;
          }

          localStorageRemove(key);
        }),
      );

      return writeQueue;
    },
  };
}

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

async function openPersistDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(INDEXED_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB."));
  });
}

async function withObjectStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openPersistDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(INDEXED_DB_STORE, mode);
    const store = transaction.objectStore(INDEXED_DB_STORE);
    const request = handler(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha na operação do IndexedDB."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("Falha na transação do IndexedDB."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("Transação do IndexedDB abortada."));
    };
  });
}

function indexedDbGet<T>(key: string): Promise<T | undefined> {
  return withObjectStore("readonly", (store) => store.get(key));
}

async function indexedDbSet(key: string, value: unknown): Promise<void> {
  await withObjectStore("readwrite", (store) => store.put(value, key));
}

async function indexedDbRemove(key: string): Promise<void> {
  await withObjectStore("readwrite", (store) => store.delete(key));
}

function localStorageGet<T>(key: string): T | null {
  const cachedData = window.localStorage.getItem(key);
  return cachedData ? (JSON.parse(cachedData) as T) : null;
}

function localStorageSet(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function localStorageRemove(key: string): void {
  window.localStorage.removeItem(key);
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
