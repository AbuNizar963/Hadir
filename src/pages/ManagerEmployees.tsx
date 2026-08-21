import { useMemo, useState, useRef, useEffect } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getEmployees, saveEmployees, getAttendance, getSettings, forceCheckInByManager, getRequests, updateRequestStatus, EmployeeRequest } from "@/lib/storage";
import { backendEnabled, getBackendEmployees, getBackendLocations, saveBackendLocation, createBackendEmployee, updateBackendEmployee, deleteBackendEmployee, resetBackendEmployeeDevice, updateBackendRequest, getBackendRequests } from "@/lib/backend";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, EmployeeStatus, ScheduleType, Location } from "@/types";
import { addNotification } from "@/lib/notifications";
import SmartEmployeeImport from "@/components/employees/SmartEmployeeImport";

// ...
