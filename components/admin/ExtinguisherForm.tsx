"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ExtinguisherTypeFormDialog } from "@/components/admin/ExtinguisherTypeFormDialog";
import { DateInput } from "@/components/shared/DateInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/utils/supabaseError";
import {
  extinguisherSchema,
  type ExtinguisherFormValues,
} from "@/lib/validations/extinguisher.schema";
import type {
  Building,
  Extinguisher,
  ExtinguisherType,
  Floor,
  Site,
  Vehicle,
} from "@/types/domain";
import type { Database } from "@/types/database.types";

interface ExtinguisherFormProps {
  sites: Site[];
  buildings: Building[];
  floors: Floor[];
  vehicles: Vehicle[];
  types: ExtinguisherType[];
  extinguisher?: Extinguisher;
}

export function ExtinguisherForm({
  sites,
  buildings,
  floors,
  vehicles,
  types,
  extinguisher,
}: ExtinguisherFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!extinguisher;

  const initialFloor = floors.find((f) => f.id === extinguisher?.floor_id);
  const initialVehicle = vehicles.find((v) => v.id === extinguisher?.vehicle_id);
  // 차량도 건물 소속이므로 건물 경로는 층/차량 어느 쪽에서든 찾는다
  const initialBuildingId = initialFloor?.building_id ?? initialVehicle?.building_id ?? "";
  const initialBuilding = buildings.find((b) => b.id === initialBuildingId);
  const initialSiteId = initialBuilding?.site_id ?? "";

  const [siteId, setSiteId] = useState(initialSiteId);
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  // 폼이 열린 상태에서 종류를 새로 추가하면 server props가 갱신되기 전에도 바로 목록에 반영한다.
  const [localTypes, setLocalTypes] = useState(types);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExtinguisherFormValues>({
    resolver: zodResolver(extinguisherSchema),
    defaultValues: {
      location_type: extinguisher?.location_type ?? "BUILDING",
      floor_id: extinguisher?.floor_id ?? undefined,
      zone_id: extinguisher?.zone_id ?? undefined,
      vehicle_id: extinguisher?.vehicle_id ?? undefined,
      extinguisher_no: extinguisher?.extinguisher_no ?? undefined,
      extinguisher_type_id: extinguisher?.extinguisher_type_id ?? "",
      manufacture_date: extinguisher?.manufacture_date ?? "",
      // null은 '내용연수 없음'이므로 ?? 로 덮어쓰면 안 된다
      useful_life_years: extinguisher ? extinguisher.useful_life_years : 10,
      capacity: extinguisher?.capacity ?? "",
      install_note: extinguisher?.install_note ?? "",
      serial_no: extinguisher?.serial_no ?? "",
    },
  });

  const locationType = watch("location_type");
  const noUsefulLife = watch("useful_life_years") === null;

  const filteredBuildings = useMemo(
    () => buildings.filter((b) => b.site_id === siteId),
    [buildings, siteId]
  );
  const filteredFloors = useMemo(
    () => floors.filter((f) => f.building_id === buildingId),
    [floors, buildingId]
  );
  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => v.building_id === buildingId),
    [vehicles, buildingId]
  );

  // Base UI Select는 items를 명시적으로 줘야 트리거에 라벨을 보여준다(안 주면 원시 value가 보임).
  const siteItems = useMemo(
    () => sites.map((s) => ({ value: s.id, label: `${s.org_code} — ${s.name}` })),
    [sites]
  );
  const buildingItems = useMemo(
    () =>
      filteredBuildings.map((b) => ({
        value: b.id,
        label: `${b.building_no}동${b.name ? ` (${b.name})` : ""}`,
      })),
    [filteredBuildings]
  );
  const floorItems = useMemo(
    () => filteredFloors.map((f) => ({ value: f.id, label: `${f.name} [${f.floor_code}]` })),
    [filteredFloors]
  );
  const vehicleItems = useMemo(
    () =>
      filteredVehicles.map((v) => ({
        value: v.id,
        label: `차량 ${v.vehicle_no}호${v.plate_no ? ` [${v.plate_no}]` : ""}${v.name ? ` (${v.name})` : ""}`,
      })),
    [filteredVehicles]
  );
  const typeItems = useMemo(
    () => localTypes.map((t) => ({ value: t.id, label: t.name })),
    [localTypes]
  );

  async function onSubmit(values: ExtinguisherFormValues) {
    setSubmitting(true);
    const supabase = createClient();

    const payload: Database["public"]["Tables"]["extinguishers"]["Insert"] =
      values.location_type === "BUILDING"
        ? {
            location_type: "BUILDING",
            floor_id: values.floor_id,
            zone_id: values.zone_id || null,
            vehicle_id: null,
            extinguisher_type_id: values.extinguisher_type_id,
            manufacture_date: values.manufacture_date,
            useful_life_years: values.useful_life_years,
            capacity: values.capacity,
            install_note: values.install_note,
            serial_no: values.serial_no || null,
          }
        : {
            location_type: "VEHICLE",
            floor_id: null,
            zone_id: null,
            vehicle_id: values.vehicle_id,
            extinguisher_type_id: values.extinguisher_type_id,
            manufacture_date: values.manufacture_date,
            useful_life_years: values.useful_life_years,
            capacity: values.capacity,
            install_note: values.install_note,
            serial_no: values.serial_no || null,
          };

    // 끝자리를 지정했을 때만 보낸다. 비우면 트리거가 자동 채번한다.
    if (values.extinguisher_no != null) {
      payload.extinguisher_no = values.extinguisher_no;
    }

    const { error, data } = isEdit
      ? await supabase
          .from("extinguishers")
          .update(payload)
          .eq("id", extinguisher.id)
          .select("id, asset_code")
          .single()
      : await supabase.from("extinguishers").insert(payload).select("id, asset_code").single();

    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(
      isEdit ? `관리번호가 ${data.asset_code}로 갱신되었습니다` : `관리번호 ${data.asset_code}로 등록되었습니다`
    );
    router.push(`/extinguishers/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-xl flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel>위치 유형</FieldLabel>
          <Tabs
            value={locationType}
            onValueChange={(v) => {
              if (!v) return;
              setValue("location_type", v as "BUILDING" | "VEHICLE");
              setValue("floor_id", undefined);
              setValue("zone_id", undefined);
              setValue("vehicle_id", undefined);
            }}
          >
            <TabsList>
              <TabsTrigger value="BUILDING">건물</TabsTrigger>
              <TabsTrigger value="VEHICLE">차량</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>

        <Field>
          <FieldLabel>사업장</FieldLabel>
          <Select
            items={siteItems}
            value={siteId}
            onValueChange={(v) => {
              if (!v) return;
              setSiteId(v);
              setBuildingId("");
              setValue("floor_id", undefined);
              setValue("zone_id", undefined);
              setValue("vehicle_id", undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="사업장 선택" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.org_code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>건물</FieldLabel>
          <Select
            items={buildingItems}
            value={buildingId}
            onValueChange={(v) => {
              if (!v) return;
              setBuildingId(v);
              setValue("floor_id", undefined);
              setValue("zone_id", undefined);
              setValue("vehicle_id", undefined);
            }}
            disabled={!siteId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="건물 선택" />
            </SelectTrigger>
            <SelectContent>
              {filteredBuildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.building_no}동{b.name ? ` (${b.name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {locationType === "BUILDING" ? (
          <>
            <Field data-invalid={!!errors.floor_id}>
              <FieldLabel>층</FieldLabel>
              <Select
                items={floorItems}
                value={watch("floor_id") ?? ""}
                onValueChange={(v) => {
                  if (!v) return;
                  setValue("floor_id", v);
                  setValue("zone_id", undefined);
                }}
                disabled={!buildingId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="층 선택" />
                </SelectTrigger>
                <SelectContent>
                  {filteredFloors.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} [{f.floor_code}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={errors.floor_id ? [errors.floor_id] : undefined} />
            </Field>
          </>
        ) : (
          <Field data-invalid={!!errors.vehicle_id}>
            <FieldLabel>차량</FieldLabel>
            <Select
              items={vehicleItems}
              value={watch("vehicle_id") ?? ""}
              onValueChange={(v) => v && setValue("vehicle_id", v)}
              disabled={!buildingId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="차량 선택" />
              </SelectTrigger>
              <SelectContent>
                {filteredVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    차량 {v.vehicle_no}호{v.plate_no ? ` [${v.plate_no}]` : ""}
                    {v.name ? ` (${v.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={errors.vehicle_id ? [errors.vehicle_id] : undefined} />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="install_note">설치 위치</FieldLabel>
          <Input id="install_note" placeholder="예: 출입구 옆 소화전함" {...register("install_note")} />
        </Field>

        <Field data-invalid={!!errors.extinguisher_no}>
          <FieldLabel htmlFor="extinguisher_no">관리번호 끝자리 (선택)</FieldLabel>
          <Input
            id="extinguisher_no"
            type="number"
            min={1}
            className="w-40"
            placeholder="비워두면 자동 부여"
            {...register("extinguisher_no", {
              setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
            })}
          />
          <p className="text-muted-foreground text-xs">
            비워두면 자동으로 다음 번호가 부여됩니다. 직접 지정하면 그 번호로 등록되며, 이미 사용
            중인 번호이면 저장이 막힙니다.
          </p>
          <FieldError errors={errors.extinguisher_no ? [errors.extinguisher_no] : undefined} />
        </Field>

        <Field data-invalid={!!errors.extinguisher_type_id}>
          <div className="flex items-center justify-between">
            <FieldLabel>소화기 종류</FieldLabel>
            <ExtinguisherTypeFormDialog
              onCreated={(newType) => {
                setLocalTypes((prev) => [...prev, newType]);
                setValue("extinguisher_type_id", newType.id);
                if (!isEdit) setValue("useful_life_years", newType.default_useful_life_years);
              }}
            />
          </div>
          <Select
            items={typeItems}
            value={watch("extinguisher_type_id")}
            onValueChange={(v) => {
              if (!v) return;
              setValue("extinguisher_type_id", v);
              const type = localTypes.find((t) => t.id === v);
              if (type && !isEdit) setValue("useful_life_years", type.default_useful_life_years);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="종류 선택" />
            </SelectTrigger>
            <SelectContent>
              {localTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={errors.extinguisher_type_id ? [errors.extinguisher_type_id] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="capacity">소화기 용량</FieldLabel>
          <Input id="capacity" placeholder="예: 3.3kg" {...register("capacity")} />
        </Field>

        <Field data-invalid={!!errors.manufacture_date}>
          <FieldLabel htmlFor="manufacture_date">제조일</FieldLabel>
          <DateInput
            id="manufacture_date"
            value={watch("manufacture_date")}
            onChange={(v) => setValue("manufacture_date", v, { shouldValidate: !!errors.manufacture_date })}
          />
          <FieldError errors={errors.manufacture_date ? [errors.manufacture_date] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="serial_no">제조번호</FieldLabel>
          <Input id="serial_no" placeholder="소화기 명판의 제조번호" {...register("serial_no")} />
        </Field>

        <Field data-invalid={!!errors.useful_life_years}>
          <FieldLabel htmlFor="useful_life_years">내용연수(년)</FieldLabel>
          <div className="flex items-center gap-3">
            <Input
              id="useful_life_years"
              type="number"
              className="w-28"
              disabled={noUsefulLife}
              value={watch("useful_life_years") ?? ""}
              onChange={(e) =>
                setValue(
                  "useful_life_years",
                  e.target.value === "" ? undefined! : Number(e.target.value)
                )
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={noUsefulLife}
                onCheckedChange={(checked) =>
                  setValue("useful_life_years", checked ? null : 10)
                }
              />
              내용연수 없음
            </label>
          </div>
          <FieldError errors={errors.useful_life_years ? [errors.useful_life_years] : undefined} />
        </Field>
      </FieldGroup>

      {isEdit && (
        <p className="text-muted-foreground text-xs">
          현재 관리번호: <span className="font-mono">{extinguisher.asset_code}</span> — 위치를
          변경하면 관리번호가 자동으로 갱신되고 이전 번호는 이력으로 보존됩니다.
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "저장 중..." : isEdit ? "수정 저장" : "등록"}
      </Button>
    </form>
  );
}
