"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  extinguisherSchema,
  type ExtinguisherFormValues,
} from "@/lib/validations/extinguisher.schema";
import type { Building, Extinguisher, ExtinguisherType, Floor, Site, Zone } from "@/types/domain";

interface ExtinguisherFormProps {
  sites: Site[];
  buildings: Building[];
  floors: Floor[];
  zones: Zone[];
  types: ExtinguisherType[];
  extinguisher?: Extinguisher;
  initialSiteId?: string;
  initialBuildingId?: string;
}

export function ExtinguisherForm({
  sites,
  buildings,
  floors,
  zones,
  types,
  extinguisher,
  initialSiteId,
  initialBuildingId,
}: ExtinguisherFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!extinguisher;

  const initialFloor = floors.find((f) => f.id === extinguisher?.floor_id);
  const initialBuilding = buildings.find((b) => b.id === initialFloor?.building_id);

  const [siteId, setSiteId] = useState(initialBuilding?.site_id ?? initialSiteId ?? "");
  const [buildingId, setBuildingId] = useState(initialFloor?.building_id ?? initialBuildingId ?? "");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExtinguisherFormValues>({
    resolver: zodResolver(extinguisherSchema),
    defaultValues: {
      code: extinguisher?.code ?? "",
      floor_id: extinguisher?.floor_id ?? "",
      zone_id: extinguisher?.zone_id ?? undefined,
      extinguisher_type_id: extinguisher?.extinguisher_type_id ?? "",
      manufacture_date: extinguisher?.manufacture_date ?? "",
      useful_life_years: extinguisher?.useful_life_years ?? 10,
      capacity: extinguisher?.capacity ?? "",
      install_note: extinguisher?.install_note ?? "",
    },
  });

  const floorId = watch("floor_id");

  const filteredBuildings = useMemo(
    () => buildings.filter((b) => b.site_id === siteId),
    [buildings, siteId]
  );
  const filteredFloors = useMemo(
    () => floors.filter((f) => f.building_id === buildingId),
    [floors, buildingId]
  );
  const filteredZones = useMemo(() => zones.filter((z) => z.floor_id === floorId), [zones, floorId]);

  async function onSubmit(values: ExtinguisherFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const payload = { ...values, zone_id: values.zone_id || null };

    const { error, data } = isEdit
      ? await supabase.from("extinguishers").update(payload).eq("id", extinguisher.id).select("id").single()
      : await supabase.from("extinguishers").insert(payload).select("id").single();

    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: error.message });
      return;
    }

    toast.success(isEdit ? "소화기 정보를 수정했습니다" : "소화기를 등록했습니다");
    router.push(`/extinguishers/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-xl flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={!!errors.code}>
          <FieldLabel htmlFor="code">관리번호</FieldLabel>
          <Input id="code" placeholder="예: A동-3F-001" {...register("code")} />
          <FieldError errors={errors.code ? [errors.code] : undefined} />
        </Field>

        <Field>
          <FieldLabel>사업장</FieldLabel>
          <Select
            value={siteId}
            onValueChange={(v) => {
              if (!v) return;
              setSiteId(v);
              setBuildingId("");
              setValue("floor_id", "");
              setValue("zone_id", undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="사업장 선택" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>건물</FieldLabel>
          <Select
            value={buildingId}
            onValueChange={(v) => {
              if (!v) return;
              setBuildingId(v);
              setValue("floor_id", "");
              setValue("zone_id", undefined);
            }}
            disabled={!siteId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="건물 선택" />
            </SelectTrigger>
            <SelectContent>
              {filteredBuildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field data-invalid={!!errors.floor_id}>
          <FieldLabel>층</FieldLabel>
          <Select
            value={watch("floor_id")}
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
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={errors.floor_id ? [errors.floor_id] : undefined} />
        </Field>

        <Field>
          <FieldLabel>구역 (선택)</FieldLabel>
          <Select
            value={watch("zone_id") ?? ""}
            onValueChange={(v) => setValue("zone_id", v || undefined)}
            disabled={!floorId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="구역 선택 (선택사항)" />
            </SelectTrigger>
            <SelectContent>
              {filteredZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field data-invalid={!!errors.extinguisher_type_id}>
          <FieldLabel>소화기 종류</FieldLabel>
          <Select
            value={watch("extinguisher_type_id")}
            onValueChange={(v) => {
              if (!v) return;
              setValue("extinguisher_type_id", v);
              const type = types.find((t) => t.id === v);
              if (type && !isEdit) setValue("useful_life_years", type.default_useful_life_years);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="종류 선택" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={errors.extinguisher_type_id ? [errors.extinguisher_type_id] : undefined} />
        </Field>

        <Field data-invalid={!!errors.manufacture_date}>
          <FieldLabel htmlFor="manufacture_date">제조일</FieldLabel>
          <Input id="manufacture_date" type="date" {...register("manufacture_date")} />
          <FieldError errors={errors.manufacture_date ? [errors.manufacture_date] : undefined} />
        </Field>

        <Field data-invalid={!!errors.useful_life_years}>
          <FieldLabel htmlFor="useful_life_years">내용연수(년)</FieldLabel>
          <Input
            id="useful_life_years"
            type="number"
            {...register("useful_life_years", { valueAsNumber: true })}
          />
          <FieldError errors={errors.useful_life_years ? [errors.useful_life_years] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="capacity">용량</FieldLabel>
          <Input id="capacity" placeholder="예: 3.3kg" {...register("capacity")} />
        </Field>

        <Field>
          <FieldLabel htmlFor="install_note">설치 위치 비고</FieldLabel>
          <Input id="install_note" placeholder="예: 출입구 옆 소화전함" {...register("install_note")} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={submitting}>
        {submitting ? "저장 중..." : isEdit ? "수정 저장" : "등록"}
      </Button>
    </form>
  );
}
