import React, {
  ForwardedRef,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { FieldArrayContext } from "../field-array/context";
import {
  FieldInstance,
  FieldInstanceProps,
  useFieldLike,
  useFieldLikeSync,
  useListenToListenToArray,
} from "../field";
import { fillPath, getPath, stringToPath } from "../utils";
import { FormContext } from "../form";
import { FieldArrayInstance } from "../field-array";

export interface FieldArrayItemRenderProps<T = any, F = any>
  extends FieldInstanceProps<T, F> {
  children: (props: FieldInstance<T, F>) => JSX.Element;
  memoChild?: any[];
}

export function FieldArrayItemComp<T = any, F = any>(
  props: FieldArrayItemRenderProps<T, F>,
  ref: ForwardedRef<FieldInstance<T, F>>
) {
  const { children, memoChild } = props;

  const {
    _normalizedDotName,
    errors,
    setErrors,
    runFieldValidation,
    isValid,
    isTouched,
    setIsTouched,
    isDirty,
    setIsDirty,
    validate,
  } = useFieldLike<T, F, FieldInstance<T, F>>({
    props,
    initialValue: "" as T,
  });

  const array = useContext(FieldArrayContext) as FieldArrayInstance<T>;
  const formContext = useContext(FormContext);

  const fullAccessorPath = useMemo(() => {
    const arrayNamePathArr = stringToPath(array.props.name);
    const fieldItemPathArr = stringToPath(props.name);
    for (const i of arrayNamePathArr) {
      if (i !== fieldItemPathArr.shift()) {
        throw new Error(
          "You must prepend the FieldArrayItem name with the name of the parent FieldArray"
        );
      }
    }
    return fieldItemPathArr;
  }, [array.props.name, props.name]);

  const itemIndex = useMemo(() => {
    return parseInt(fullAccessorPath[0]);
  }, [fullAccessorPath]);

  const accessorPath = useMemo(() => {
    return fullAccessorPath.slice(1);
  }, [fullAccessorPath]);

  const value = useMemo(() => {
    return getPath(array.value[itemIndex] as object, accessorPath.join("."));
  }, [accessorPath, array.value, itemIndex]);

  const valueRef = useRef(value);

  valueRef.current = value;

  useListenToListenToArray({
    listenTo: props.listenTo,
    runFieldValidation,
    valueRef,
  });

  const setValue = useCallback(
    (v: T | ((prevState: T) => T)) => {
      const isPrevAFunction = (t: any): t is (prevState: T) => T =>
        typeof t === "function";

      const newVal = isPrevAFunction(v) ? v(array.value[itemIndex]) : v;

      const newArrayObject = { ...array.value[itemIndex] } as object;
      fillPath(newArrayObject, accessorPath.join("."), newVal);
      array.setValue(itemIndex, newArrayObject as T);

      setIsDirty(true);

      /**
       * Call `listenTo` field subscribers for other fields.
       *
       * Placed into a `setTimeout` so that the `setValue` call can finish before the `onChangeListenerRefs` are called.
       */
      setTimeout(() => {
        formContext.onChangeListenerRefs.current[props.name]?.forEach((fn) =>
          fn()
        );
      }, 0);

      runFieldValidation("onChangeValidate", newVal);
    },
    [
      accessorPath,
      array,
      formContext.onChangeListenerRefs,
      itemIndex,
      props.name,
      runFieldValidation,
      setIsDirty,
      setIsTouched,
    ]
  );

  const onBlur = useCallback(() => {
    setIsTouched(true);

    /**
     * Call `listenTo` field subscribers for other fields.
     *
     * Placed into a `setTimeout` so that the `setValue` call can finish before the `onChangeListenerRefs` are called.
     */
    setTimeout(() => {
      formContext.onBlurListenerRefs.current[props.name]?.forEach((fn) => fn());
    }, 0);

    runFieldValidation("onBlurValidate", valueRef.current);
  }, [
    formContext.onBlurListenerRefs,
    props.name,
    runFieldValidation,
    setIsTouched,
    valueRef,
  ]);

  const fieldArrayInstance = useMemo(() => {
    return {
      setValue,
      errors,
      value,
      _normalizedDotName,
      onBlur,
      props,
      isTouched,
      isValid,
      isDirty,
      setIsDirty,
      setErrors,
      setIsTouched,
      validate,
    };
  }, [
    setValue,
    errors,
    value,
    _normalizedDotName,
    onBlur,
    props,
    isTouched,
    isValid,
    isDirty,
    setIsDirty,
    setErrors,
    setIsTouched,
    validate,
  ]);

  const mutableRef = useRef<FieldInstance<T>>(fieldArrayInstance);

  useFieldLikeSync<T, F, FieldInstance<T, F>>({
    mutableRef,
    props,
    value,
    errors,
    isValid,
    isDirty,
    isTouched,
  });

  useImperativeHandle(ref, () => fieldArrayInstance, [fieldArrayInstance]);

  const memoizedChildren = useMemo(
    () => {
      return children(fieldArrayInstance);
    },
    memoChild
      ? memoChild.concat(fieldArrayInstance)
      : [children, fieldArrayInstance]
  );

  return memoizedChildren;
}

export const FieldArrayItem = memo(forwardRef(FieldArrayItemComp)) as <
  T = any,
  F = any
>(
  props: FieldArrayItemRenderProps<T, F> & {
    ref?: ForwardedRef<FieldInstance<T, F>>;
  }
) => ReturnType<typeof FieldArrayItemComp>;
