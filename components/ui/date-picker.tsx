"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function useSafeCommonTranslations() {
  try {
    return useTranslations("common");
  } catch {
    return null;
  }
}
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  getDay,
  isBefore,
  isAfter,
  startOfDay,
  isSameDay,
} from "date-fns";

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "min" | "max"> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  value?: string | Date;
  defaultValue?: string | Date;
  min?: string | number | Date;
  max?: string | number | Date;
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      className,
      label,
      error,
      success,
      hint,
      value,
      defaultValue,
      min,
      max,
      id,
      onChange,
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    const t = useSafeCommonTranslations();
    const effectivePlaceholder = placeholder ?? (t?.("selectDate") || "Select date...");
    const generatedId = React.useId();
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [open, setOpen] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
      value
        ? typeof value === "string"
          ? parseISO(value)
          : value
        : defaultValue
          ? typeof defaultValue === "string"
            ? parseISO(defaultValue)
            : defaultValue
          : undefined
    );

    const [currentMonth, setCurrentMonth] = React.useState<Date>(
      selectedDate && isValid(selectedDate) ? selectedDate : new Date()
    );

    React.useEffect(() => {
      if (value) {
        const parsed = typeof value === "string" ? parseISO(value) : value;
        if (isValid(parsed)) {
          setSelectedDate(parsed);
        } else {
          setSelectedDate(undefined);
        }
      } else {
        setSelectedDate(undefined);
      }
    }, [value]);

    const isDateDisabled = React.useCallback(
      (date: Date) => {
        const checkDate = startOfDay(date);
        if (min) {
          const minD = startOfDay(
            min instanceof Date
              ? min
              : typeof min === "number"
                ? new Date(min)
                : parseISO(min)
          );
          if (isValid(minD) && isBefore(checkDate, minD)) return true;
        }
        if (max) {
          const maxD = startOfDay(
            max instanceof Date
              ? max
              : typeof max === "number"
                ? new Date(max)
                : parseISO(max)
          );
          if (isValid(maxD) && isAfter(checkDate, maxD)) return true;
        }
        return false;
      },
      [min, max]
    );

    const handleDateSelect = (date: Date) => {
      if (isDateDisabled(date) || disabled) return;

      const dateString = format(date, "yyyy-MM-dd");
      setSelectedDate(date);
      setOpen(false);

      if (onChange) {
        const event = {
          target: {
            name: props.name,
            value: dateString,
            id: inputId,
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    const nextMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const prevMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    // Calendar Grid Calculation
    const daysInWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDayOfWeek = getDay(monthStart);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Padded days from previous month
    const prevMonthEnd = endOfMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    const totalDaysInMonth = monthEnd.getDate();
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Padded days from next month (fill up 6 rows of 7 = 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    const formattedValue = selectedDate && isValid(selectedDate) ? format(selectedDate, "yyyy-MM-dd") : "";

    const ariaDescribedBy = [
      error ? errorId : null,
      hint ? hintId : null,
      props["aria-describedby"],
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}

        {/* Visually-hidden input registered with react-hook-form.
            We use className="sr-only" rather than type="hidden" so that
            React's synthetic onChange fires correctly (type="hidden" inputs
            silently swallow React change events, breaking RTL tests).
            tabIndex={-1} ensures keyboard users skip it (the trigger button
            is the keyboard target). */}
        <input
          className="sr-only"
          tabIndex={-1}
          id={inputId}
          ref={ref}
          name={props.name}
          value={formattedValue}
          onChange={onChange}
          {...props}
        />

        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-describedby={ariaDescribedBy || undefined}
              className={cn(
                "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground flex items-center justify-between transition-colors",
                "border-input cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-ring/50 focus:border-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !selectedDate && "text-muted-foreground",
                success && !error && "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30",
                error && "border-destructive/50 focus:border-destructive focus:ring-destructive/30",
                className
              )}
            >
              <span className="truncate">
                {selectedDate && isValid(selectedDate) ? format(selectedDate, "PPP") : effectivePlaceholder}
              </span>
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            >
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-zinc-200">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-lg border border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-lg border border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {daysInWeek.map((day) => (
                  <span key={day} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {day}
                  </span>
                ))}
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 gap-1">
                {days.map(({ date, isCurrentMonth }, idx) => {
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isDisabled = isDateDisabled(date);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDateSelect(date)}
                      className={cn(
                        "h-8 w-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer relative",
                        !isCurrentMonth && "text-zinc-600",
                        isCurrentMonth && !isSelected && !isDisabled && "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
                        isSelected && "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20",
                        isDisabled && "opacity-25 cursor-not-allowed",
                        isToday && !isSelected && "border border-primary/40 text-primary"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
