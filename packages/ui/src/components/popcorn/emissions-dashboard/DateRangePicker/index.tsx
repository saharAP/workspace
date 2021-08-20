import React, { useRef, useState, useEffect } from 'react';

const MONTH_LIST = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ESCAPE_KEY = 27;

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}


export const CalendarInput = ({ isStart, label }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [daysList, setDaysList] = useState([]);
  const [blankDaysList, setBlankDaysList] = useState([]);
  // const [month, setMonth] = useState(0);
  // const [year, setYear] = useState(0);
  const date = useRef(null);
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const defaultValue = new Date(
    year,
    month,
    today.getDate()
  ).toDateString();

  const handleKeyDown = (event) => {
    if(event.keyCode = ESCAPE_KEY) {
      setShowCalendar(false);
    };
  }

  const getDateValue = (day) => {
    console.log('day is ', day);
  }

  const isToday = (date) => {
    const today = new Date();
    const newDate = new Date(year, month, date);
    return today.toDateString() === newDate.toDateString()
  }

  const getNoOfDays = (isNextMonth=false) => {
    let daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    // Find where to start calendar day of week
    let dayOfWeek = new Date(year, month).getDay();
    let blankDays = [];
    for (var i = 1; i <= dayOfWeek; i++) {
      blankDays.push(i);
    }

    let daysArray = [];
    for (var i = 1; i <= daysInMonth; i++) {
      daysArray.push(i);
    }

    setDaysList(daysArray)
    setBlankDaysList(blankDays);
    // setMonth();
    // setYear();
  }

  useEffect(() => {
    getNoOfDays()
  }, []);

  return (
    <div className="container mx-auto px-4 py-2">
      <div className="w-64">
        {label &&
        <label
          htmlFor="datepicker"
          className="font-bold mb-1 text-gray-700 block"
        >
          {label}
        </label>
        }
        <div className="relative">
          <input type="hidden" name="date" ref={date} />
          <input
            type="text"
            readOnly
            onClick={() => setShowCalendar(!showCalendar)}
            onKeyDown={(e) => handleKeyDown(e)}
            // defaultValue={defaultValue}
            // x-model="datepickerValue"
            // @click="showDatepicker = !showDatepicker"
            // @keydown.escape="showDatepicker = false"
            className="w-full pl-4 pr-10 py-3 leading-none rounded-lg shadow-sm focus:outline-none focus:shadow-outline text-gray-600 font-medium"
            placeholder="Select date"
          />

          <div
          className="absolute top-0 right-0 px-3 py-2"
          onClick={() => setShowCalendar(!showCalendar)}
          >
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          {showCalendar && 
          (
            <div
                className="bg-white mt-12 rounded-lg shadow p-4 absolute top-0 left-0"
                style={{width: '17rem'}}
                // @click.away="showDatepicker = false" // TODO: Implement click away
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span
                      className="text-lg font-bold text-gray-800"
                    >
                      {MONTH_LIST[month]}
                    </span>
                    <span
                      className="ml-1 text-lg text-gray-600 font-normal"
                    >{year}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={classNames(
                        month == 0 ? 'cursor-not-allowed opacity-25' : '',
                        'transition ease-in-out duration-100 inline-flex cursor-point p-1 rounded-full'
                      )}
                      disabled={month === 0}
                      onClick={() => getNoOfDays(false)}
                      // :class="{'cursor-not-allowed opacity-25': }"
                      // :disabled="month == 0 ? true : false"
                      // @click="month--; getNoOfDays()"
                    >
                      <svg
                        className="h-6 w-6 text-gray-500 inline-flex"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        month == 11 ? 'cursor-not-allowed opacity-25' : '',
                        'transition ease-in-out duration-100 inline-flex cursor-point p-1 rounded-full'
                      )}
                      // :class="{'cursor-not-allowed opacity-25': month == 11 }"
                      // :disabled="month == 11 ? true : false"
                      // @click="month++; getNoOfDays()"
                      disabled={month === 0}
                      onClick={() => getNoOfDays(true)}
                    >
                      <svg
                        className="h-6 w-6 text-gray-500 inline-flex"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
  
                <div className="flex flex-wrap mb-3 -mx-1">
                  {DAYS.map(day => (
                    <div style={{ width: "14.26%" }} className="px-1" key={day}>
                    <div
                      className="text-gray-800 font-medium text-center text-xs"
                    >{day}</div>
                  </div>
                  ))}
                </div>
  
                <div className="flex flex-wrap -mx-1">
                  {blankDaysList.map(day => (
                     <div
                     key={day}
                     style={{width: '14.28%'}}
                     className="text-center border p-1 border-transparent text-sm"
                   >{day}</div>
                  ))}
                  {daysList.map(date => (
                     <div
                     style={{width: "14.28%"}}
                     className="px-1 mb-1"
                     key={date}>
                     <div
                       onClick={() => getDateValue(date)}
                      className={classNames(
                        isToday(date) ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-blue-200',
                        "cursor-pointer text-center text-sm leading-none rounded-full leading-loose transition ease-in-out duration-100"
                      )}
                     >{date}</div>
                   </div>
                  ))}
                </div>
              </div>
          )
        }
        </div>
      </div>
    </div>
  );
};

export const DateRangePicker = () => {
  return (
    <div className="grid justify-items-stretch md:mr-24">
      <div className="md:flex md:items-center md:justify-between justify-self-end">
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <CalendarInput isStart={true} />
          <CalendarInput isStart={false} />
          <button
            type="button"
            className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-10 self-center"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
};
