import { describe, expect, it } from "vitest";
import { coerceProject, mergeProjects, type Project } from "./projects";

function sample(over: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Casa",
    note: "",
    status: "activo",
    due: "",
    entityId: "pessoal",
    updatedAt: "2026-10-27T10:00:00.000Z",
    ...over,
  };
}

describe("projectos", () => {
  it("aceita o registo e ignora nome vazio", () => {
    expect(coerceProject({ id: "p-1", name: "  Casa  ", status: "parado", entity_id: "ph" })?.name).toBe(
      "Casa",
    );
    expect(coerceProject({ id: "p-1", name: "  Casa  ", status: "parado", entity_id: "ph" })?.status).toBe(
      "parado",
    );
    expect(coerceProject({ id: "p-1", name: "  Casa  ", status: "parado", entity_id: "ph" })?.entityId).toBe(
      "ph",
    );
    expect(coerceProject({ id: "p-1", name: "   " })).toBeNull();
    expect(coerceProject({ id: "p-1", name: "Casa", status: "outro" })?.status).toBe("activo");
  });

  it("fica com a versão mais recente", () => {
    const older = sample({ name: "Casa", updatedAt: "2026-10-27T09:00:00.000Z" });
    const newer = sample({ name: "Casa nova", updatedAt: "2026-10-27T12:00:00.000Z" });
    expect(mergeProjects([newer], [older])[0]?.name).toBe("Casa nova");
    expect(mergeProjects([older], [newer])[0]?.name).toBe("Casa nova");
  });
});
