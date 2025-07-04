/**************************************************************
 * Global Variables and Data Storage:
 * These variables and arrays hold the state of the application,
 * such as bank accounts, bills, expenses, paydays, etc.
 **************************************************************/
let bankAccounts = [];
let recurringBills = [];
let oneTimeExpenses = [];
let paydays = [];
let balanceTrackingEnabled = false;
let tempExpenseMonths = [];
let lockedDistribution = {}; // Holds locked custom distribution values for paycheck allocations

/**************************************************************
 * Helper Function: getCycleDaysInMonth
 * Returns the number of days in the month based on the selected cycle date.
 **************************************************************/
function getCycleDaysInMonth() {
  const cycleDateVal = document.getElementById("cycleDate").value;
  if (cycleDateVal) {
    let dt = new Date(cycleDateVal);
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  }
  return 31; // Default if no date is selected
}

/**************************************************************
 * Helper Function: isDueWithin
 * Checks if a given due date is within the specified pay period.
 * Accounts for pay periods that may span the end of a month.
 **************************************************************/
function isDueWithin(dueDate, periodStart, periodEnd, daysInMonth, cycleMonth) {
  // Adjust dueDate for month rollover if it's in the next month's range but conceptually part of the current period
  let adjustedDueDate = dueDate;
  if (periodStart > periodEnd && dueDate < periodStart) {
    // This means the period wraps around the month end (e.g., 25th to 5th)
    // If dueDate is less than periodStart, it must be in the *next* month to be in this period.
    // We don't need to adjust the dueDate value itself, but rather ensure the month check is correct.
  }

  // Check if the due date falls within the day range of the period
  const isDayWithinRange =
    periodStart <= periodEnd
      ? adjustedDueDate >= periodStart && adjustedDueDate <= periodEnd
      : (adjustedDueDate >= periodStart && adjustedDueDate <= daysInMonth) ||
        (adjustedDueDate >= 1 && adjustedDueDate <= periodEnd);

  // For expenses with specific months, we also need to check if the expense's month matches the cycle month.
  // This function is primarily for day-based filtering within a period,
  // so the month-specific logic for 'specific' planType expenses should be handled
  // where `isDueWithin` is called for those expenses.
  // For general bills and 'occurrence' or 'one-time' expenses, we assume they are relevant to the current cycle month.

  return isDayWithinRange;
}

/**************************************************************
 * Helper Function: effectiveDueDate
 * Adjusts due dates that exceed the number of days in the month.
 **************************************************************/
function effectiveDueDate(dueDate, daysInMonth) {
  return dueDate > daysInMonth ? daysInMonth : dueDate;
}

/**************************************************************
 * Utility Function: updateBankAccountDropdowns
 * Updates the dropdown menus in bills and expenses forms with current bank accounts.
 **************************************************************/
function updateBankAccountDropdowns() {
  const billSelect = document.getElementById("billBankAccount");
  const expenseSelect = document.getElementById("expenseBankAccount");
  billSelect.innerHTML = '<option value="">Select Bank Account</option>';
  expenseSelect.innerHTML = '<option value="">Select Bank Account</option>';
  bankAccounts.forEach((account) => {
    const option1 = document.createElement("option");
    option1.value = account.id;
    option1.textContent = account.name;
    billSelect.appendChild(option1);
    const option2 = document.createElement("option");
    option2.value = account.id;
    option2.textContent = account.name;
    expenseSelect.appendChild(option2);
  });
}

/**************************************************************
 * Function: updateDistributionSection
 * Refreshes the paycheck distribution options based on the current bank accounts.
 **************************************************************/
function updateDistributionSection() {
  const singleAccountSelector = document.getElementById(
    "singleAccountSelector"
  );
  singleAccountSelector.innerHTML = "";
  bankAccounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    singleAccountSelector.appendChild(option);
  });
  if (document.getElementById("distributionMethod").value === "custom") {
    updateCustomAllocationFields();
  }
}

/**************************************************************
 * Function: updateCustomAllocationFields
 * Dynamically creates input fields for custom allocation amounts
 * for each bank account.
 **************************************************************/
function updateCustomAllocationFields() {
  const customAllocDiv = document.getElementById("customAllocationFields");
  customAllocDiv.innerHTML = "";
  bankAccounts.forEach((account) => {
    const div = document.createElement("div");
    div.innerHTML = `<label for="customAlloc_${account.id}">${account.name} Allocation (per pay period):</label>
                        <input type="number" id="customAlloc_${account.id}" placeholder="Amount" step="0.01">`;
    customAllocDiv.appendChild(div);
    const inputElem = div.querySelector("input");
    inputElem.addEventListener("input", updateCustomAllocationCounter);
  });
  // Add a counter to show remaining amount to be allocated
  const counterDiv = document.createElement("div");
  counterDiv.id = "customAllocationCounter";
  counterDiv.textContent = "Remaining to distribute: $0";
  customAllocDiv.appendChild(counterDiv);
  // Add a button to lock in the custom distribution if it doesn't already exist
  if (!document.getElementById("addDistributionBtn")) {
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "addDistributionBtn";
    addBtn.textContent = "Lock Custom Distribution";
    addBtn.addEventListener("click", lockCustomDistribution);
    customAllocDiv.appendChild(addBtn);
  }
  if (!document.getElementById("lockedDistributionContainer")) {
    const lockDiv = document.createElement("div");
    lockDiv.id = "lockedDistributionContainer";
    customAllocDiv.appendChild(lockDiv);
  }
  customAllocDiv.classList.remove("hidden");
}

/**************************************************************
 * Function: updateCustomAllocationCounter
 * Calculates the remaining amount to allocate based on user inputs.
 **************************************************************/
function updateCustomAllocationCounter() {
  let target = balanceTrackingEnabled
    ? parseFloat(document.getElementById("expectedPaycheck").value)
    : paydays.length > 0
    ? paydays[0].paycheckAmount
    : 0;
  let sum = 0;
  bankAccounts.forEach((account) => {
    let input = document.getElementById("customAlloc_" + account.id);
    if (input && input.value !== "") {
      sum += parseFloat(input.value);
    }
  });
  let remaining = target - sum;
  const counterElem = document.getElementById("customAllocationCounter");
  if (counterElem) {
    counterElem.textContent =
      "Remaining to distribute: $" + remaining.toFixed(2);
  }
}

/**************************************************************
 * Function: lockCustomDistribution
 * Locks in the custom allocation values after verifying they sum correctly.
 **************************************************************/
function lockCustomDistribution() {
  let target = balanceTrackingEnabled
    ? parseFloat(document.getElementById("expectedPaycheck").value)
    : paydays.length > 0
    ? paydays[0].paycheckAmount
    : 0;
  let total = 0;
  let allocations = {};
  bankAccounts.forEach((account) => {
    let input = document.getElementById("customAlloc_" + account.id);
    let val = input && input.value !== "" ? parseFloat(input.value) : 0;
    allocations[account.id] = val;
    total += val;
  });
  if (Math.abs(total - target) > 0.01) {
    alert(
      "The total of custom allocations must equal the paycheck amount of $" +
        target.toFixed(2) +
        ". Current total: $" +
        total.toFixed(2)
    );
    return;
  }
  lockedDistribution = allocations;
  // Disable inputs once distribution is locked
  bankAccounts.forEach((account) => {
    let input = document.getElementById("customAlloc_" + account.id);
    if (input) {
      input.disabled = true;
    }
  });
  updateLockedDistributionDisplay();
}

/**************************************************************
 * Function: updateLockedDistributionDisplay
 * Shows the locked allocation values and allows removal.
 **************************************************************/
function updateLockedDistributionDisplay() {
  const container = document.getElementById("lockedDistributionContainer");
  container.innerHTML = "";
  for (let accId in lockedDistribution) {
    let amount = lockedDistribution[accId];
    let account = bankAccounts.find((a) => a.id === accId);
    let div = document.createElement("div");
    div.classList.add("locked-item");
    div.innerHTML = `<span>${account.name}: $${amount.toFixed(2)}</span>`;
    let delBtn = document.createElement("button");
    delBtn.classList.add("locked-delete-btn");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", function () {
      delete lockedDistribution[accId];
      let input = document.getElementById("customAlloc_" + accId);
      if (input) {
        input.disabled = false;
        input.value = "";
      }
      updateCustomAllocationCounter();
      updateLockedDistributionDisplay();
    });
    div.appendChild(delBtn);
    container.appendChild(div);
  }
}

/**************************************************************
 * Event Listener: Toggle display of "Specific Day" input for paydays.
 **************************************************************/
document.getElementById("paydayType").addEventListener("change", function () {
  const specificInput = document.getElementById("specificDayInput");
  if (this.value === "specific") {
    specificInput.classList.remove("hidden");
  } else {
    specificInput.classList.add("hidden");
  }
});

/**************************************************************
 * Event Listener: Toggle bank balance tracking.
 * When enabled, extra fields for paycheck tracking are shown.
 **************************************************************/
document
  .getElementById("balanceTrackingToggle")
  .addEventListener("change", function () {
    balanceTrackingEnabled = this.checked;
    const dynamicContainer = document.getElementById("balanceTrackingDynamic");
    if (balanceTrackingEnabled) {
      dynamicContainer.classList.remove("hidden");
    } else {
      dynamicContainer.classList.add("hidden");
    }
    updateBankAccountList();
  });

/**************************************************************
 * Event Listener: Change distribution method.
 * Updates the UI to show/hide custom allocation or single account selector.
 **************************************************************/
document
  .getElementById("distributionMethod")
  .addEventListener("change", function () {
    const method = this.value;
    const customDiv = document.getElementById("customAllocationFields");
    const singleDiv = document.getElementById("singleAccountSelectorContainer");
    if (method === "custom") {
      customDiv.classList.remove("hidden");
      singleDiv.classList.add("hidden");
      updateCustomAllocationFields();
    } else if (method === "single") {
      singleDiv.classList.remove("hidden");
      customDiv.classList.add("hidden");
      updateDistributionSection();
    } else {
      customDiv.classList.add("hidden");
      singleDiv.classList.add("hidden");
    }
  });

/**************************************************************
 * Event Listener: Add a new payday.
 * Restricts the user to one payday entry.
 **************************************************************/
document.getElementById("paydayForm").addEventListener("submit", function (e) {
  e.preventDefault();
  if (paydays.length > 0) {
    alert(
      "Only one payday type can be selected. Remove the existing one to add a new one."
    );
    return;
  }
  const type = document.getElementById("paydayType").value;
  let day = null;
  if (!type) {
    alert("Please select a payday type.");
    return;
  }
  if (type === "specific") {
    day = parseInt(document.getElementById("specificDay").value);
    if (isNaN(day) || day < 1 || day > 31) {
      alert("Enter a valid day of month (1–31).");
      return;
    }
  }
  const id = Date.now().toString() + "_pd";
  paydays.push({ id, type, day });
  updatePaydayList();
  document.getElementById("paydayType").value = "";
  document.getElementById("specificDay").value = "";
  document.getElementById("specificDayInput").classList.add("hidden");
});

/**************************************************************
 * Function: updatePaydayList
 * Updates the UI list of paydays.
 **************************************************************/
function updatePaydayList() {
  const paydayList = document.getElementById("paydayList");
  paydayList.innerHTML = "";
  paydays.forEach((pd) => {
    let pdText = "";
    if (pd.type === "specific") {
      pdText = "Day " + pd.day;
    } else if (pd.type === "1st15") {
      pdText = "1st and 15th";
    } else {
      pdText = pd.type.charAt(0).toUpperCase() + pd.type.slice(1);
    }
    const li = document.createElement("li");
    li.innerHTML = `<span class="item-text">${pdText}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("delete-btn");
    delBtn.addEventListener("click", function () {
      paydays = paydays.filter((item) => item.id !== pd.id);
      updatePaydayList();
    });
    li.appendChild(delBtn);
    paydayList.appendChild(li);
  });
}

/**************************************************************
 * Event Listener: Add a new bank account.
 * Saves the bank account name and optionally its balance.
 **************************************************************/
document
  .getElementById("bankAccountForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("bankName").value;
    const balanceInput = document.getElementById("bankBalance").value;
    const balance = balanceInput
      ? parseFloat(balanceInput)
      : balanceTrackingEnabled
      ? 0
      : null;
    const id = Date.now().toString() + "_bank";
    bankAccounts.push({ id, name, balance });
    updateBankAccountList();
    updateBankAccountDropdowns();
    updateDistributionSection();
    document.getElementById("bankName").value = "";
    document.getElementById("bankBalance").value = "";
  });

/**************************************************************
 * Function: updateBankAccountList
 * Updates the UI list of bank accounts.
 **************************************************************/
function updateBankAccountList() {
  const bankList = document.getElementById("bankAccountList");
  bankList.innerHTML = "";
  bankAccounts.forEach((account) => {
    const balText =
      account.balance !== null && !isNaN(account.balance)
        ? `$${account.balance.toFixed(2)}`
        : "N/A";
    const li = document.createElement("li");
    li.innerHTML = `<span class="item-text">${account.name} - Balance: ${balText}</span>`;
    if (balanceTrackingEnabled) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit Balance";
      editBtn.classList.add("edit-btn");
      editBtn.addEventListener("click", function () {
        const newBalance = prompt(
          "Enter new current balance for " + account.name,
          account.balance
        );
        if (newBalance !== null) {
          account.balance = parseFloat(newBalance);
          updateBankAccountList();
        }
      });
      li.insertBefore(editBtn, li.firstChild);
    }
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("delete-btn");
    delBtn.addEventListener("click", function () {
      bankAccounts = bankAccounts.filter((item) => item.id !== account.id);
      recurringBills = recurringBills.filter(
        (bill) => bill.bankAccountId !== account.id
      );
      oneTimeExpenses = oneTimeExpenses.filter(
        (exp) => exp.bankAccountId !== account.id
      );
      updateBankAccountList();
      updateBankAccountDropdowns();
      updateDistributionSection();
      updateBillList();
      updateExpenseList();
    });
    li.appendChild(delBtn);
    bankList.appendChild(li);
  });
}

/**************************************************************
 * Event Listener: Add a new recurring bill.
 * Collects details and adds the bill to the recurringBills array.
 **************************************************************/
document.getElementById("billForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("billName").value;
  const amount = parseFloat(document.getElementById("billAmount").value);
  let dueDate = parseInt(document.getElementById("billDueDate").value);
  const bankAccountId = document.getElementById("billBankAccount").value;
  if (!bankAccountId) {
    alert("Please select a bank account for the bill.");
    return;
  }
  const id = Date.now().toString() + "_bill";
  recurringBills.push({ id, name, amount, dueDate, bankAccountId });
  updateBillList();
  document.getElementById("billName").value = "";
  document.getElementById("billAmount").value = "";
  document.getElementById("billDueDate").value = "";
  document.getElementById("billBankAccount").value = "";
});

/**************************************************************
 * Function: updateBillList
 * Refreshes the list of recurring bills displayed in the UI.
 **************************************************************/
function updateBillList() {
  const billList = document.getElementById("billList");
  billList.innerHTML = "";
  recurringBills.sort((a, b) => a.dueDate - b.dueDate);
  const days = getCycleDaysInMonth();
  recurringBills.forEach((bill) => {
    const bankAccount = bankAccounts.find(
      (acc) => acc.id === bill.bankAccountId
    );
    const li = document.createElement("li");
    li.classList.add("bill-item");
    li.innerHTML = `<span class="item-text">${
      bill.name
    } - $${bill.amount.toFixed(2)} due on Day ${effectiveDueDate(
      bill.dueDate,
      days
    )} from ${bankAccount ? bankAccount.name : ""}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("delete-btn");
    delBtn.addEventListener("click", function () {
      recurringBills = recurringBills.filter((item) => item.id !== bill.id);
      updateBillList();
    });
    li.appendChild(delBtn);
    billList.appendChild(li);
  });
}

/**************************************************************
 * Event Listener: Toggle Expense Plan Type.
 * Shows the appropriate input fields based on the chosen plan.
 **************************************************************/
const expensePlanTypeRadios = document.getElementsByName("expensePlanType");
expensePlanTypeRadios.forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.value === "occurrence") {
      document.getElementById("occurrenceSection").classList.remove("hidden");
      document.getElementById("specificMonthsSection").classList.add("hidden");
    } else {
      document.getElementById("occurrenceSection").classList.add("hidden");
      document
        .getElementById("specificMonthsSection")
        .classList.remove("hidden");
    }
  });
});

/**************************************************************
 * Event Listener: Add a Selected Month for a Periodic Expense.
 **************************************************************/
document
  .getElementById("addExpenseMonthBtn")
  .addEventListener("click", function () {
    const monthSelect = document.getElementById("expenseMonthSelect");
    const month = monthSelect.value;
    if (!tempExpenseMonths.includes(month)) {
      tempExpenseMonths.push(month);
      updateExpenseMonthsList();
    }
  });

/**************************************************************
 * Function: updateExpenseMonthsList
 * Updates the list of selected months for the "Specific Months" option.
 **************************************************************/
function updateExpenseMonthsList() {
  const list = document.getElementById("expenseMonthsList");
  list.innerHTML = "";
  tempExpenseMonths.forEach((m, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="item-text">${monthName(parseInt(m))}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("delete-btn");
    delBtn.addEventListener("click", function () {
      tempExpenseMonths.splice(index, 1);
      updateExpenseMonthsList();
    });
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

/**************************************************************
 * Helper Function: monthName
 * Returns the full name of the month based on its numeric value.
 **************************************************************/
function monthName(m) {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return names[m - 1] || "";
}

/**************************************************************
 * Event Listener: Add a new Periodic Expense.
 * Collects all data for the expense and adds it to the oneTimeExpenses array.
 **************************************************************/
document.getElementById("expenseForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("expenseName").value;
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  let dueDate = parseInt(document.getElementById("expenseDueDate").value);
  const bankAccountId = document.getElementById("expenseBankAccount").value;
  if (!bankAccountId) {
    alert("Please select a bank account for the expense.");
    return;
  }
  let planType = document.querySelector(
    'input[name="expensePlanType"]:checked'
  ).value;
  let occurrences = 0;
  let specificMonths = [];
  if (planType === "occurrence") {
    occurrences =
      parseInt(document.getElementById("expenseOccurrences").value) || 0;
  } else if (planType === "specific") {
    specificMonths = [...tempExpenseMonths];
    tempExpenseMonths = [];
    updateExpenseMonthsList();
  }
  const id = Date.now().toString() + "_expense";
  oneTimeExpenses.push({
    id,
    name,
    amount,
    dueDate,
    bankAccountId,
    planType,
    occurrences,
    specificMonths,
  });
  updateExpenseList();
  document.getElementById("expenseName").value = "";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expenseDueDate").value = "";
  document.getElementById("expenseBankAccount").value = "";
  document.getElementById("expenseOccurrences").value = "";
  document.querySelector(
    'input[name="expensePlanType"][value="occurrence"]'
  ).checked = true;
  document.getElementById("occurrenceSection").classList.remove("hidden");
  document.getElementById("specificMonthsSection").classList.add("hidden");
});

/**************************************************************
 * Function: updateExpenseList
 * Refreshes the list of periodic expenses displayed in the UI.
 **************************************************************/
function updateExpenseList() {
  const expenseList = document.getElementById("expenseList");
  expenseList.innerHTML = "";
  oneTimeExpenses.forEach((exp) => {
    const bankAccount = bankAccounts.find(
      (acc) => acc.id === exp.bankAccountId
    );
    let expText = `${exp.name} - $${exp.amount.toFixed(2)} due on Day ${
      exp.dueDate
    }`;
    if (exp.planType === "occurrence" && exp.occurrences > 0) {
      expText += ` | Occurs ${exp.occurrences}x/yr`;
    } else if (exp.planType === "specific" && exp.specificMonths.length > 0) {
      expText += ` | Due in: ${exp.specificMonths
        .map((m) => monthName(parseInt(m)))
        .join(", ")}`;
    } else {
      expText += " (One-Time)";
    }
    const li = document.createElement("li");
    li.classList.add("expense-item");
    li.innerHTML = `<span class="item-text">${expText} from ${
      bankAccount ? bankAccount.name : ""
    }</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("delete-btn");
    delBtn.addEventListener("click", function () {
      oneTimeExpenses = oneTimeExpenses.filter((item) => item.id !== exp.id);
      updateExpenseList();
    });
    li.appendChild(delBtn);
    expenseList.appendChild(li);
  });
}

/**************************************************************
 * Helper Function: getExpectedPayPeriodsPerYear
 * Returns an estimate of how many pay periods occur in a year
 * based on the type of payday set.
 **************************************************************/
function getExpectedPayPeriodsPerYear() {
  let periods = 12;
  if (paydays.some((pd) => pd.type === "daily")) {
    periods = 365;
  } else if (paydays.some((pd) => pd.type === "weekly")) {
    periods = 52;
  } else if (paydays.some((pd) => pd.type === "1st15")) {
    periods = 24;
  }
  return periods;
}

/**************************************************************
 * NEW Centralized Pay Period Calculation Function
 * Replaces getMostRecentPaydayDay and computeNextPaydayDiff.
 * This function is the single source of truth for determining the
 * start and end of any pay period based on the cycle date.
 **************************************************************/
function getPayPeriodInfo(cycleDate, payday) {
  const year = cycleDate.getFullYear();
  const month = cycleDate.getMonth(); // 0-indexed
  const day = cycleDate.getDate();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  let periodStart, periodEnd;

  switch (payday.type) {
    case "1st15":
      if (day < 15) {
        periodStart = 1;
        periodEnd = 14;
      } else {
        periodStart = 15;
        periodEnd = getDaysInMonth(year, month);
      }
      break;

    case "specific":
      const paydayDay = payday.day;
      const daysInCurrentMonth = getDaysInMonth(year, month);
      const effectivePayday = Math.min(paydayDay, daysInCurrentMonth);

      if (day < effectivePayday) {
        // Period is from last month's payday to this month's payday-1
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();
        periodStart = Math.min(paydayDay, daysInPrevMonth);
        periodEnd = effectivePayday - 1;
      } else {
        // Period is from this month's payday to next month's payday-1
        const nextMonth = new Date(year, month + 2, 0);
        const daysInNextMonth = nextMonth.getDate();
        periodStart = effectivePayday;
        periodEnd = Math.min(paydayDay, daysInNextMonth) - 1;
      }
      break;

    case "weekly":
      // Establishes a consistent 7-day cycle for predictability.
      // The cycles run 1-7, 8-14, 15-21, 22-28, and 29 to the end of the month.
      if (day <= 7) {
        periodStart = 1;
        periodEnd = 7;
      } else if (day <= 14) {
        periodStart = 8;
        periodEnd = 14;
      } else if (day <= 21) {
        periodStart = 15;
        periodEnd = 21;
      } else if (day <= 28) {
        periodStart = 22;
        periodEnd = 28;
      } else {
        periodStart = 29;
        periodEnd = getDaysInMonth(year, month);
      }
      break;

    case "monthly":
      periodStart = 1;
      periodEnd = getDaysInMonth(year, month);
      break;

    case "daily":
      periodStart = day;
      periodEnd = day;
      break;

    default:
      // Fallback for when no payday is set by the user.
      periodStart = 1;
      periodEnd = getDaysInMonth(year, month);
      break;
  }

  // Calculate lengths, correctly handling month rollovers.
  const daysInMonth = getDaysInMonth(year, month);
  let fullPeriodLength;
  if (periodStart <= periodEnd) {
    fullPeriodLength = periodEnd - periodStart + 1;
  } else {
    // This handles rollovers for the 'specific' payday case.
    fullPeriodLength =
      getDaysInMonth(year, month - 1) - periodStart + 1 + periodEnd;
  }

  const remainingDays = periodEnd - day + 1;

  return {
    periodStart: periodStart,
    periodEnd: periodEnd,
    fullPeriodLength: fullPeriodLength,
    remainingDays: remainingDays,
    // A display-friendly version for the UI to show "[next month]" if needed.
    periodEndDisplay:
      payday.type === "specific" && day >= payday.day
        ? `${periodEnd} [next month]`
        : periodEnd.toString(),
  };
}

/**************************************************************
 * Calculation Function:
 * Handles the main calculation of required balances, expenses, and paycheck allocations.
 **************************************************************/
document
  .getElementById("calculateButton")
  .addEventListener("click", function () {
    const cycleDateStr = document.getElementById("cycleDate").value;
    if (!cycleDateStr) {
      alert("Please select a cycle date.");
      return;
    }
    const cycleDate = new Date(cycleDateStr);
    const selectedDay = cycleDate.getDate();
    const currentDaysInMonth = new Date(
      cycleDate.getFullYear(),
      cycleDate.getMonth() + 1,
      0
    ).getDate();

    // Use the new, reliable function to get all period info.
    // Default to a 'monthly' type if the user hasn't set a payday.
    const paydaySetting = paydays.length > 0 ? paydays[0] : { type: "monthly" };
    const periodInfo = getPayPeriodInfo(cycleDate, paydaySetting);
    const {
      periodStart,
      periodEnd,
      fullPeriodLength,
      remainingDays,
      periodEndDisplay,
    } = periodInfo;
    const fullPeriodStart = periodInfo.periodStart; // Use the start from our reliable function.

    document.getElementById(
      "payPeriodRange"
    ).textContent = `This section displays the expenses for the current pay period (Day ${fullPeriodStart} to Day ${periodEndDisplay}, ${fullPeriodLength} days).`;

    let paycheck = balanceTrackingEnabled
      ? parseFloat(document.getElementById("expectedPaycheck").value)
      : 0;
    if (balanceTrackingEnabled && (isNaN(paycheck) || paycheck <= 0)) {
      alert("Please enter a valid Expected Paycheck Amount.");
      return;
    }

    // Calculate required expenses (from the cycle date to period end) for each bank account
    let requiredExpenses = {};
    bankAccounts.forEach((account) => {
      const billsForAccount = recurringBills.filter((bill) => {
        // For recurring bills, we assume they are monthly unless specified otherwise.
        // If a recurring bill has a specific month property (which it currently doesn't in the data model),
        // that would be checked here. For now, we only filter by due date within the period.
        return (
          bill.bankAccountId === account.id &&
          isDueWithin(
            effectiveDueDate(bill.dueDate, currentDaysInMonth),
            selectedDay,
            periodEnd,
            currentDaysInMonth,
            cycleDate.getMonth() + 1
          )
        );
      });
      let totalBills = 0;
      billsForAccount.forEach((bill) => {
        totalBills += bill.amount;
      });
      let totalPeriodic = 0;
      oneTimeExpenses.forEach((exp) => {
        if (exp.bankAccountId === account.id) {
          if (exp.planType === "occurrence" && exp.occurrences > 0) {
            totalPeriodic +=
              (exp.amount * exp.occurrences) / getExpectedPayPeriodsPerYear();
          } else if (
            exp.planType === "specific" &&
            exp.specificMonths.length > 0
          ) {
            if (
              exp.specificMonths.includes(
                (cycleDate.getMonth() + 1).toString()
              ) &&
              isDueWithin(
                exp.dueDate,
                selectedDay,
                periodEnd,
                currentDaysInMonth,
                cycleDate.getMonth() + 1 // Pass the current month
              )
            ) {
              totalPeriodic += exp.amount;
            }
          } else {
            if (
              isDueWithin(
                exp.dueDate,
                selectedDay,
                periodEnd,
                currentDaysInMonth,
                cycleDate.getMonth() + 1 // Pass the current month
              )
            ) {
              totalPeriodic += exp.amount;
            }
          }
        }
      });
      requiredExpenses[account.id] = totalBills + totalPeriodic;
    });

    // Calculate total expenses for the full pay period (from the most recent payday)
    let totalExpenses = {};
    bankAccounts.forEach((account) => {
      const billsForAccountTotal = recurringBills.filter((bill) => {
        // Similar to above, assuming recurring bills are monthly.
        return (
          bill.bankAccountId === account.id &&
          isDueWithin(
            effectiveDueDate(bill.dueDate, currentDaysInMonth),
            fullPeriodStart,
            periodEnd,
            currentDaysInMonth,
            cycleDate.getMonth() + 1
          )
        );
      });
      let totalBillsTotal = 0;
      billsForAccountTotal.forEach((bill) => {
        totalBillsTotal += bill.amount;
      });
      let totalPeriodicTotal = 0;
      oneTimeExpenses.forEach((exp) => {
        if (exp.bankAccountId === account.id) {
          if (exp.planType === "occurrence" && exp.occurrences > 0) {
            totalPeriodicTotal +=
              (exp.amount * exp.occurrences) / getExpectedPayPeriodsPerYear();
          } else if (
            exp.planType === "specific" &&
            exp.specificMonths.length > 0
          ) {
            if (
              exp.specificMonths.includes(
                (cycleDate.getMonth() + 1).toString()
              ) &&
              isDueWithin(
                exp.dueDate,
                fullPeriodStart,
                periodEnd,
                currentDaysInMonth,
                cycleDate.getMonth() + 1 // Pass the current month
              )
            ) {
              totalPeriodicTotal += exp.amount;
            }
          } else {
            if (
              isDueWithin(
                exp.dueDate,
                fullPeriodStart,
                periodEnd,
                currentDaysInMonth,
                cycleDate.getMonth() + 1 // Pass the current month
              )
            ) {
              totalPeriodicTotal += exp.amount;
            }
          }
        }
      });
      totalExpenses[account.id] = totalBillsTotal + totalPeriodicTotal;
    });

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    // For each bank account, build and display a summary of required balances and upcoming items
    let overallAllocated = 0;
    bankAccounts.forEach((account) => {
      let allocated = 0;
      if (balanceTrackingEnabled) {
        const method = document.getElementById("distributionMethod").value;
        if (method === "equal") {
          allocated = paycheck / bankAccounts.length;
        } else if (method === "custom") {
          let input = document.getElementById("customAlloc_" + account.id);
          allocated =
            input && input.value !== ""
              ? parseFloat(input.value)
              : paycheck / bankAccounts.length;
        } else if (method === "single") {
          let selectedAccountId = document.getElementById(
            "singleAccountSelector"
          ).value;
          allocated = account.id === selectedAccountId ? paycheck : 0;
        } else if (method === "proportional") {
          let totalReq = Object.values(requiredExpenses).reduce(
            (a, b) => a + b,
            0
          );
          // FIX: If total required expenses is 0, fallback to equal split to avoid division by zero.
          if (totalReq > 0) {
            allocated = paycheck * (requiredExpenses[account.id] / totalReq);
          } else {
            allocated = paycheck / bankAccounts.length; // Fallback to equal split
          }
        }
      }
      overallAllocated += allocated;
      const totalRequired = requiredExpenses[account.id] || 0;
      // Calculate surplus (or deficit) based on the current bank balance
      const currentBalance =
        account.balance !== null && !isNaN(account.balance)
          ? account.balance
          : 0;
      const surplus = currentBalance - totalRequired;
      const dailySpendBudget =
        remainingDays > 0 ? surplus / remainingDays : surplus;

      // Create a summary block for the bank account
      const accountDiv = document.createElement("div");
      accountDiv.classList.add("account-summary");
      const header = document.createElement("h3");
      header.textContent = account.name;
      accountDiv.appendChild(header);

      if (balanceTrackingEnabled) {
        const depositPara = document.createElement("p");
        depositPara.textContent = `Initial Deposit for this Pay Period: $${allocated.toFixed(
          2
        )}`;
        accountDiv.appendChild(depositPara);

        const currentBalancePara = document.createElement("p");
        currentBalancePara.textContent = `Remaining Balance for this Bank Account: $${currentBalance.toFixed(
          2
        )}`;
        accountDiv.appendChild(currentBalancePara);
      }

      const requiredPara = document.createElement("p");
      requiredPara.textContent = `Remaining Expenses for This Pay Period for this account: $${totalRequired.toFixed(
        2
      )}`;
      accountDiv.appendChild(requiredPara);

      if (balanceTrackingEnabled) {
        const surplusPara = document.createElement("p");
        if (surplus >= 0) {
          surplusPara.style.color = "green";
          surplusPara.textContent = `Estimated Surplus for This Pay Period: $${surplus.toFixed(
            2
          )}`;
        } else {
          surplusPara.style.color = "red";
          surplusPara.textContent = `Estimated Deficit for This Pay Period: $${Math.abs(
            surplus
          ).toFixed(2)}`;
        }
        accountDiv.appendChild(surplusPara);

        const dailyPara = document.createElement("p");
        dailyPara.textContent = `Daily Spend Budget for the Remainder of This Pay Period (${remainingDays} days): $${dailySpendBudget.toFixed(
          2
        )}`;
        accountDiv.appendChild(dailyPara);
      }

      // Display upcoming bills/expenses for this account
      const listHeader = document.createElement("p");
      listHeader.textContent = "Upcoming Bills/Expenses:";
      accountDiv.appendChild(listHeader);
      const list = document.createElement("ul");
      if (
        upcomingItemsForAccount(
          account.id,
          selectedDay, // Change periodStart to selectedDay
          periodEnd,
          currentDaysInMonth
        ).length === 0
      ) {
        const li = document.createElement("li");
        li.textContent = "None";
        list.appendChild(li);
      } else {
        upcomingItemsForAccount(
          account.id,
          selectedDay, // Change periodStart to selectedDay
          periodEnd,
          currentDaysInMonth
        ).forEach((item) => {
          const dueDay = effectiveDueDate(item.dueDate, currentDaysInMonth);
          let itemText = "";
          if (item.type === "bill") {
            itemText = `${item.name} - $${item.amount.toFixed(
              2
            )} (Bill) due on Day ${dueDay}`;
          } else {
            if (item.planType === "occurrence" && item.occurrences > 0) {
              itemText = `${item.name} - $${item.amount.toFixed(
                2
              )} (Expense, Occurs ${
                item.occurrences
              }x/yr) due on Day ${dueDay}`;
            } else if (
              item.planType === "specific" &&
              item.specificMonths.length > 0
            ) {
              itemText = `${item.name} - $${item.amount.toFixed(
                2
              )} (Expense, Due in: ${item.specificMonths
                .map((m) => monthName(parseInt(m)))
                .join(", ")}) due on Day ${dueDay}`;
            } else {
              itemText = `${item.name} - $${item.amount.toFixed(
                2
              )} (Expense, One-Time) due on Day ${dueDay}`;
            }
          }
          const li = document.createElement("li");
          li.textContent = itemText;
          list.appendChild(li);
        });
      }
      accountDiv.appendChild(list);
      resultsDiv.appendChild(accountDiv);
    });

    // Calculate and display total expenses for the pay period
    let combinedTotalExpenses = 0;
    bankAccounts.forEach((acc) => {
      combinedTotalExpenses += totalExpenses[acc.id] || 0;
    });
    let overallSurplus = paycheck - combinedTotalExpenses;
    if (balanceTrackingEnabled) {
      document.getElementById("payPeriodCombined").innerHTML =
        `<strong>Total Expenses for This Pay Period:</strong> $${combinedTotalExpenses.toFixed(
          2
        )}<br>` +
        `<span style="color:${
          overallSurplus >= 0 ? "green" : "red"
        };">Estimated Surplus for This Pay Period: $${overallSurplus.toFixed(
          2
        )}</span>`;
    } else {
      document.getElementById(
        "payPeriodCombined"
      ).innerHTML = `<strong>Total Expenses for This Pay Period:</strong> $${combinedTotalExpenses.toFixed(
        2
      )}`;
    }

    // Monthly Totals Calculation:
    let monthlyTotals = {};
    bankAccounts.forEach((acc) => {
      monthlyTotals[acc.id] = 0;
    });
    recurringBills.forEach((bill) => {
      monthlyTotals[bill.bankAccountId] += bill.amount;
    });
    oneTimeExpenses.forEach((exp) => {
      if (exp.planType === "occurrence" && exp.occurrences > 0) {
        monthlyTotals[exp.bankAccountId] += (exp.amount * exp.occurrences) / 12;
      } else if (exp.planType === "specific" && exp.specificMonths.length > 0) {
        if (
          exp.specificMonths.includes((cycleDate.getMonth() + 1).toString())
        ) {
          monthlyTotals[exp.bankAccountId] += exp.amount;
        }
      }
    });
    let combinedMonthly = 0;
    for (let id in monthlyTotals) {
      combinedMonthly += monthlyTotals[id];
    }
    let expectedPayPeriodsPerYear = getExpectedPayPeriodsPerYear();
    let monthlyPaycheck = paycheck * (expectedPayPeriodsPerYear / 12);
    let monthlyBankList = "";
    bankAccounts.forEach((acc) => {
      let monthlyAllocated = 0;
      if (balanceTrackingEnabled) {
        const method = document.getElementById("distributionMethod").value;
        if (method === "equal") {
          monthlyAllocated = monthlyPaycheck / bankAccounts.length;
        } else if (method === "custom") {
          let input = document.getElementById("customAlloc_" + acc.id);
          let perPay =
            input && input.value !== ""
              ? parseFloat(input.value)
              : paycheck / bankAccounts.length;
          monthlyAllocated = perPay * (expectedPayPeriodsPerYear / 12);
        } else if (method === "single") {
          let selectedAccountId = document.getElementById(
            "singleAccountSelector"
          ).value;
          monthlyAllocated = acc.id === selectedAccountId ? monthlyPaycheck : 0;
        } else if (method === "proportional") {
          let totalReq = Object.values(requiredExpenses).reduce(
            (a, b) => a + b,
            0
          );
          monthlyAllocated =
            totalReq > 0
              ? monthlyPaycheck * (requiredExpenses[acc.id] / totalReq)
              : monthlyPaycheck / bankAccounts.length;
        }
      }
      const surplusMonthly = monthlyAllocated - (monthlyTotals[acc.id] || 0);
      monthlyBankList += `<h4>${acc.name} - Total Expenses: $${monthlyTotals[
        acc.id
      ].toFixed(2)}</h4>`;
      if (balanceTrackingEnabled) {
        monthlyBankList += `<p>Estimated Monthly Deposit for ${
          acc.name
        }: $${monthlyAllocated.toFixed(2)}</p>`;
        if (surplusMonthly >= 0) {
          monthlyBankList += `<p style="color:green;">Estimated Monthly Surplus for ${
            acc.name
          }: $${surplusMonthly.toFixed(2)}</p>`;
        } else {
          monthlyBankList += `<p style="color:red;">Estimated Monthly Deficit for ${
            acc.name
          }: $${Math.abs(surplusMonthly).toFixed(2)}</p>`;
        }
      }
      let billsList = "<ul>";
      recurringBills
        .filter((bill) => bill.bankAccountId === acc.id)
        .forEach((bill) => {
          billsList += `<li>${bill.name} - $${bill.amount.toFixed(
            2
          )} due on Day ${bill.dueDate}</li>`;
        });
      oneTimeExpenses
        .filter((exp) => exp.bankAccountId === acc.id)
        .forEach((exp) => {
          if (exp.planType === "occurrence" && exp.occurrences > 0) {
            billsList += `<li>${exp.name} - $${exp.amount.toFixed(2)} (Occurs ${
              exp.occurrences
            }x/yr)</li>`;
          } else if (
            exp.planType === "specific" &&
            exp.specificMonths.includes((cycleDate.getMonth() + 1).toString())
          ) {
            billsList += `<li>${exp.name} - $${exp.amount.toFixed(
              2
            )} (Due in: ${exp.specificMonths
              .map((m) => monthName(parseInt(m)))
              .join(", ")})</li>`;
          }
        });
      billsList += "</ul>";
      monthlyBankList += billsList;
    });
    document.getElementById(
      "monthlyCombined"
    ).innerHTML = `<strong>Combined Monthly Expenses:</strong> $${combinedMonthly.toFixed(
      2
    )}`;
    let monthlySurplus = monthlyPaycheck - combinedMonthly;
    if (balanceTrackingEnabled) {
      document.getElementById(
        "monthlyCombined"
      ).innerHTML += `<br><span style="color:${
        monthlySurplus >= 0 ? "green" : "red"
      };">Estimated Surplus for This Month: $${monthlySurplus.toFixed(
        2
      )}</span>`;
    }
    document.getElementById("monthlyByBank").innerHTML = monthlyBankList;
  });

/**************************************************************
 * Helper Function: upcomingItemsForAccount
 * Returns a sorted list of upcoming bills and expenses for a specific bank account.
 **************************************************************/
function upcomingItemsForAccount(
  accountId,
  periodStart,
  periodEnd,
  daysInMonth
) {
  let items = [];
  items = items.concat(
    recurringBills
      .filter(
        (bill) =>
          bill.bankAccountId === accountId &&
          isDueWithin(
            effectiveDueDate(bill.dueDate, daysInMonth),
            periodStart,
            periodEnd,
            daysInMonth,
            new Date(document.getElementById("cycleDate").value).getMonth() + 1 // Pass the current month
          )
      )
      .map((bill) => ({ ...bill, type: "bill" }))
  );
  items = items.concat(
    oneTimeExpenses
      .filter((exp) => {
        if (exp.bankAccountId !== accountId) return false;
        if (exp.planType === "occurrence" && exp.occurrences > 0) {
          return isDueWithin(
            exp.dueDate,
            periodStart,
            periodEnd,
            daysInMonth,
            new Date(document.getElementById("cycleDate").value).getMonth() + 1
          );
        } else if (
          exp.planType === "specific" &&
          exp.specificMonths.length > 0
        ) {
          return (
            exp.specificMonths.includes(
              (
                new Date(
                  document.getElementById("cycleDate").value
                ).getMonth() + 1
              ).toString()
            ) &&
            isDueWithin(
              exp.dueDate,
              periodStart,
              periodEnd,
              daysInMonth,
              new Date(document.getElementById("cycleDate").value).getMonth() +
                1
            )
          );
        } else {
          return isDueWithin(
            exp.dueDate,
            periodStart,
            periodEnd,
            daysInMonth,
            new Date(document.getElementById("cycleDate").value).getMonth() + 1
          );
        }
      })
      .map((exp) => ({ ...exp, type: "expense" }))
  );
  // Sort items based on their effective due date (considering wrap-around)
  items.sort((a, b) => {
    const aEff = effectiveDueDate(a.dueDate, daysInMonth);
    const bEff = effectiveDueDate(b.dueDate, daysInMonth);
    const aDue = aEff < periodStart ? aEff + daysInMonth : aEff;
    const bDue = bEff < periodStart ? bEff + daysInMonth : bEff;
    return aDue - bDue;
  });
  return items;
}

/**************************************************************
 * CSV Import Functionality for Recurring Bills.
 * Reads a CSV file and parses the data to add recurring bills.
 **************************************************************/
document
  .getElementById("recurringCSV")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a file in .csv format.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const csvData = evt.target.result;
        const lines = csvData
          .split(/\r\n|\n/)
          .filter((line) => line.trim() !== "");
        if (lines.length < 2) {
          alert("CSV file does not contain any data rows.");
          return;
        }
        const headers = lines[0].split(",").map((h) => h.trim());
        const requiredHeaders = [
          "Bill Name",
          "Bill Amount",
          "Due Date",
          "Bank Account",
        ];
        for (let header of requiredHeaders) {
          if (!headers.includes(header)) {
            alert("Recurring Bills CSV is missing required column: " + header);
            return;
          }
        }
        const data = [];
        const errors = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim() === "") continue;
          const fields = line.split(",");
          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = fields[index] ? fields[index].trim() : "";
          });
          if (
            !rowObj["Bill Name"] ||
            !rowObj["Bill Amount"] ||
            !rowObj["Due Date"] ||
            !rowObj["Bank Account"]
          ) {
            errors.push(`Row ${i + 1}: Missing required data.`);
            continue;
          }
          const amount = parseFloat(rowObj["Bill Amount"]);
          if (isNaN(amount) || amount <= 0) {
            errors.push(`Row ${i + 1}: Bill Amount must be a positive number.`);
            continue;
          }
          const dueDate = parseInt(rowObj["Due Date"]);
          if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
            errors.push(`Row ${i + 1}: Due Date must be between 1 and 31.`);
            continue;
          }
          let bankAcc = bankAccounts.find(
            (acc) =>
              acc.name.toLowerCase() === rowObj["Bank Account"].toLowerCase()
          );
          if (!bankAcc) {
            const bankId = Date.now().toString() + "_bank_csv_" + i;
            const newBank = {
              id: bankId,
              name: rowObj["Bank Account"],
              balance: null,
            };
            bankAccounts.push(newBank);
            // Ensure all relevant UI components are updated after creating a new account.
            updateBankAccountList();
            updateBankAccountDropdowns();
            updateDistributionSection();
            bankAcc = newBank;
          }
          data.push({
            id: Date.now().toString() + "_bill" + i,
            name: rowObj["Bill Name"],
            amount: amount,
            dueDate: dueDate,
            bankAccountId: bankAcc.id,
          });
        }
        if (errors.length > 0) {
          alert("Errors found while parsing CSV:\n" + errors.join("\n"));
          return;
        }
        data.forEach((bill) => recurringBills.push(bill));
        updateBillList();
        alert("Recurring bills imported successfully.");
      } catch (err) {
        console.error(err);
        alert(
          "An error occurred while processing the CSV file: " + err.message
        );
      }
    };
    reader.readAsText(file);
  });

/**************************************************************
 * Instructions Dialog Event Listeners
 **************************************************************/
document
  .getElementById("instructionsBtn")
  .addEventListener("click", function () {
    document.getElementById("instructionsDialog").showModal();
  });
document
  .getElementById("closeInstructionsBtn")
  .addEventListener("click", function () {
    document.getElementById("instructionsDialog").close();
  });
